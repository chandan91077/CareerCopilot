import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Subscription, Payment, User } from '../models';

const router = Router();

// POST /payment/subscribe - Simulate stripe session checkout creation
router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { planType, provider } = req.body;

  try {
    if (!planType || !['basic', 'premium'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid subscription plan selected' });
    }

    const priceMap = { basic: 1900, premium: 4900 }; // in cents
    const amount = priceMap[planType as 'basic' | 'premium'];

    // Create a mock subscription object
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1); // 1 month validity

    const subscription = new Subscription({
      user: req.user?.id,
      status: 'active',
      planType,
      activeEndsAt: endsAt,
      stripeSubscriptionId: `sub_mock_${Math.random().toString(36).substring(2, 10)}`
    });
    await subscription.save();

    // Create a mock payment object
    const payment = new Payment({
      user: req.user?.id,
      subscriptionId: subscription._id,
      amount: amount / 100,
      currency: 'USD',
      provider: provider || 'stripe',
      transactionId: `txn_mock_${Math.random().toString(36).substring(2, 12)}`,
      status: 'succeeded'
    });
    await payment.save();

    // Update User Plan
    await User.findByIdAndUpdate(req.user?.id, { plan: planType });

    return res.json({
      message: 'Checkout session created successfully (Simulated)',
      checkoutUrl: `http://localhost:5173/subscription?success=true&plan=${planType}`,
      subscription
    });
  } catch (error: any) {
    console.error('Simulate payment error:', error);
    return res.status(500).json({ message: 'Server error processing payment' });
  }
});

// GET /payment/status - Get current active subscription status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sub = await Subscription.findOne({ user: req.user?.id, status: 'active' }).sort({ createdAt: -1 });
    if (!sub) {
      return res.json({ plan: 'free', activeEndsAt: null });
    }
    return res.json({
      plan: sub.planType,
      activeEndsAt: sub.activeEndsAt
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    return res.status(500).json({ message: 'Server error loading subscription status' });
  }
});

// POST /payment/cancel - Cancel active subscription
router.post('/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sub = await Subscription.findOne({ user: req.user?.id, status: 'active' });
    if (!sub) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    sub.status = 'cancelled';
    await sub.save();

    await User.findByIdAndUpdate(req.user?.id, { plan: 'free' });

    return res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({ message: 'Server error cancelling subscription' });
  }
});

// POST /payment/cashfree/create-order - Initialize Cashfree session
router.post('/cashfree/create-order', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { planType } = req.body;

  try {
    if (!planType || !['basic', 'premium'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan selection' });
    }

    const priceMap = { basic: 1500, premium: 4000 }; // INR amounts
    const amount = priceMap[planType as 'basic' | 'premium'];

    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const isProd = process.env.CASHFREE_ENV === 'production';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    const orderId = `order_${Math.random().toString(36).substring(2, 10)}`;

    // Create a mock tracking subscription in database
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);

    const subscription = new Subscription({
      user: req.user?.id,
      status: 'expired', // remains expired until payment verified
      planType,
      activeEndsAt: endsAt,
      stripeSubscriptionId: `cashfree_${orderId}`
    });
    await subscription.save();

    const payment = new Payment({
      user: req.user?.id,
      subscriptionId: subscription._id,
      amount,
      currency: 'INR',
      provider: 'cashfree',
      transactionId: orderId,
      status: 'pending'
    });
    await payment.save();

    // Check if real credentials are provided
    if (!clientId || !clientSecret || clientId.includes('your_')) {
      console.log('[PAYMENT] Cashfree credentials missing. Simulating sandbox response.');
      // Return a simulated success redirection flow for dev testing
      return res.json({
        isMocked: true,
        paymentSessionId: `session_mock_${Math.random().toString(36).substring(2, 12)}`,
        orderId,
        checkoutUrl: `http://localhost:5173/subscription?success=true&plan=${planType}&order_id=${orderId}`
      });
    }

    // Call real Cashfree REST endpoint
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: req.user?.id,
          customer_email: req.user?.email,
          customer_phone: '9999999999'
        },
        order_meta: {
          return_url: `http://localhost:5173/subscription?success=true&plan=${planType}&order_id=${orderId}`
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cashfree order creation failed: ${errText}`);
    }

    const data: any = await response.json();
    return res.json({
      isMocked: false,
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
      orderStatus: data.order_status
    });
  } catch (error: any) {
    console.error('Create Cashfree Order Error:', error);
    return res.status(500).json({ message: error.message || 'Server error creating payment order' });
  }
});

// POST /payment/cashfree/verify-order - Verify the client order state
router.post('/cashfree/verify-order', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;

  try {
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const payment = await Payment.findOne({ transactionId: orderId, user: req.user?.id }).populate('subscriptionId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const isProd = process.env.CASHFREE_ENV === 'production';
    const baseUrl = isProd ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    let orderStatus = 'PAID'; // Default to success if mock is running

    if (clientId && clientSecret && !clientId.includes('your_')) {
      // Call actual verification REST API
      const response = await fetch(`${baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-client-id': clientId,
          'x-client-secret': clientSecret,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to verify order status with Cashfree.');
      }

      const data: any = await response.json();
      orderStatus = data.order_status;
    }

    if (orderStatus === 'PAID') {
      // Update DB records
      payment.status = 'succeeded';
      await payment.save();

      if (payment.subscriptionId) {
        const sub = await Subscription.findById(payment.subscriptionId);
        if (sub) {
          sub.status = 'active';
          await sub.save();
          // Update User plan details
          await User.findByIdAndUpdate(req.user?.id, { plan: sub.planType });
        }
      }

      return res.json({ verified: true, message: 'Payment verified and plan activated!' });
    } else {
      return res.json({ verified: false, status: orderStatus, message: 'Payment has not been completed yet.' });
    }
  } catch (error: any) {
    console.error('Verify Cashfree Order Error:', error);
    return res.status(500).json({ message: error.message || 'Server error verifying payment status' });
  }
});

export default router;

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Check, Sparkles, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [currentPlan, setCurrentPlan] = useState('free');

  const loadCashfreeScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Cashfree) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    const success = searchParams.get('success');
    const plan = searchParams.get('plan');
    const orderId = searchParams.get('order_id');

    async function verifyPaymentAndLoadStatus() {
      if (success && plan && orderId) {
        try {
          const verifyResponse = await api.post('/payment/cashfree/verify-order', { orderId });
          if (verifyResponse.data.verified) {
            setSuccessMsg(`Congratulations! You have successfully subscribed to the ${plan.toUpperCase()} tier!`);
            const rawUser = localStorage.getItem('user');
            if (rawUser) {
              const userObj = JSON.parse(rawUser);
              userObj.plan = plan;
              localStorage.setItem('user', JSON.stringify(userObj));
            }
          } else {
            setSuccessMsg('Payment verification failed.');
          }
        } catch (err) {
          console.error('Verify payment error:', err);
          setSuccessMsg('Error verifying payment.');
        }
      }

      // Load active subscription status
      try {
        const response = await api.get('/payment/status');
        setCurrentPlan(response.data.plan || 'free');
      } catch (err) {
        console.error(err);
      }
    }

    verifyPaymentAndLoadStatus();
  }, [searchParams]);

  const handleSubscribe = async (planType: string) => {
    setLoading(planType);
    try {
      const response = await api.post('/payment/cashfree/create-order', {
        planType
      });

      const { isMocked, checkoutUrl, paymentSessionId } = response.data;

      if (isMocked && checkoutUrl) {
        // Redirection fallback for mock settings
        window.location.href = checkoutUrl;
        return;
      }

      // Load SDK and trigger Cashfree Modal Checkout
      await loadCashfreeScript();
      const cashfree = (window as any).Cashfree({
        mode: 'sandbox' // Change to 'production' if deploy settings production environment active
      });

      await cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_self'
      });
    } catch (err) {
      console.error(err);
      alert('Subscription failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '5 mock interviews',
        'Text answers only',
        'Basic AI feedback report',
        'Standard resume parser'
      ],
      planType: 'free',
      color: 'border-slate-200 dark:border-slate-800'
    },
    {
      name: 'Basic',
      price: '$19',
      period: 'month',
      features: [
        'Unlimited mock interviews',
        'Text answers & voice input',
        'Standard AI score ratings',
        'ATS Resume matching comparison',
        'Priority email assistance'
      ],
      planType: 'basic',
      color: 'border-indigo-500/50 shadow-indigo-500/5 shadow-xl relative'
    },
    {
      name: 'Premium',
      price: '$49',
      period: 'month',
      features: [
        'Unlimited mock interviews',
        'Real-time voice synthesis and recording',
        'Monaco coding editor compiler sessions',
        'Advanced complexity static AI grade reports',
        'Behavioral STAR coach analytics report',
        '24/7 dedicated tech chat support'
      ],
      planType: 'premium',
      color: 'border-purple-500/50 shadow-purple-500/5 shadow-xl relative overflow-hidden'
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">Simple, Transparent Pricing</h1>
        <p className="text-slate-500 mt-2">Unlock unlimited mock interviews, advanced coding analysis, and real-time voice feedback.</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold text-center">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.planType;
          return (
            <div 
              key={plan.name} 
              className={`glass-panel border-2 rounded-3xl p-8 flex flex-col justify-between transition-transform hover:scale-[1.02] ${plan.color}`}
            >
              {plan.name === 'Premium' && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-extrabold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
                  Best Value
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{plan.name}</h3>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-extrabold text-slate-800 dark:text-slate-100">{plan.price}</span>
                  <span className="text-slate-400 text-sm font-semibold ml-1">/{plan.period}</span>
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      <Check className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/60">
                {isCurrent ? (
                  <div className="w-full text-center py-3 bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" /> Active Plan
                  </div>
                ) : plan.planType === 'free' ? (
                  <button 
                    disabled 
                    className="w-full text-center py-3 bg-slate-100 dark:bg-dark-800 text-slate-400 font-bold rounded-xl text-sm"
                  >
                    Default Free tier
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.planType)}
                    disabled={loading !== null}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer flex items-center justify-center"
                  >
                    {loading === plan.planType ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" /> Upgrade to {plan.name}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

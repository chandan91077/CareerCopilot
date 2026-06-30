const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load env variables
dotenv.config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-interview-platform';
const email = 'chandany67071@gmail.com';
const password = 'Shyam@7410';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  // Define User schema inline to avoid imports issues
  const userSchema = new mongoose.Schema(
    {
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ['user', 'admin'], default: 'user' },
      plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
      isVerified: { type: Boolean, default: false }
    },
    { collection: 'users' }
  );

  let User;
  try {
    User = mongoose.model('User', userSchema);
  } catch {
    User = mongoose.model('User');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    console.log(`User ${email} already exists. Promoting to admin and resetting password...`);
    user.role = 'admin';
    user.passwordHash = passwordHash;
    user.isVerified = true;
    await user.save();
    console.log('User promoted successfully.');
  } else {
    console.log(`Creating new admin user with email ${email}...`);
    user = new User({
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      role: 'admin',
      isVerified: true,
      plan: 'premium'
    });
    await user.save();
    console.log('Admin user created successfully.');
  }

  // Also create a basic Profile for the user so dashboard loads correctly
  const profileSchema = new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String },
      avatarUrl: { type: String },
      bio: { type: String },
      skills: [{ type: String }],
      experienceYears: { type: Number, default: 0 },
      targetRole: { type: String, required: true }
    },
    { collection: 'profiles' }
  );

  let Profile;
  try {
    Profile = mongoose.model('Profile', profileSchema);
  } catch {
    Profile = mongoose.model('Profile');
  }

  let profile = await Profile.findOne({ user: user._id });
  if (!profile) {
    console.log('Creating default profile for admin...');
    profile = new Profile({
      user: user._id,
      firstName: 'Chandan',
      lastName: 'Kumar',
      phone: '9999999999',
      targetRole: 'Full Stack Engineer',
      skills: ['React', 'Node.js', 'Express', 'MongoDB']
    });
    await profile.save();
    console.log('Default profile created.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});

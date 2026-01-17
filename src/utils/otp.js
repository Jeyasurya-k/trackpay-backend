// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via SMS (mock implementation)
// Replace with Twilio or other SMS service
const sendOTP = async (mobile, otp) => {
  console.log(`📱 Sending OTP ${otp} to ${mobile}`);
  // TODO: Implement actual SMS sending
  // Example with Twilio:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `Your TrackPay verification code is: ${otp}`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: mobile
  // });
  return true;
};

module.exports = { generateOTP, sendOTP };
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  paid: {
    type: Number,
    default: 0
  },
  description: String,
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  location: String,
  phone: {
    type: String,
    required: true
  },
  purchases: [purchaseSchema]
}, { timestamps: true });

// Virtual for total amount
customerSchema.virtual('totalAmount').get(function() {
  return this.purchases.reduce((sum, p) => sum + p.amount, 0);
});

// Virtual for total paid
customerSchema.virtual('totalPaid').get(function() {
  return this.purchases.reduce((sum, p) => sum + p.paid, 0);
});

// Virtual for pending amount
customerSchema.virtual('pending').get(function() {
  return this.totalAmount - this.totalPaid;
});

customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);
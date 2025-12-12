const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Define the old CSVRefund schema for migration
const csvRefundSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  twoFA: String,
  recoveryCodes: String,
  geo: String,
  date: Date,
  lastFourDigitsCard: String,
  bank: String,
  comment: String,
  psp1: String,
  broker1: String,
  psp2: String,
  broker2: String,
  step1: String,
  step2: String,
  step3: String,
  step4: String,
  step5: String,
  status: String,
  notes: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: Date,
    notes: String,
  }],
}, {
  timestamps: true,
});

const CSVRefund = mongoose.model('CSVRefund', csvRefundSchema);

// Import the new RefundAssignment model
const RefundAssignment = require('../models/RefundAssignment');

const migrateCSVRefunds = async () => {
  try {
    console.log('Starting CSV refunds migration...');
    
    // Check if CSVRefund collection exists
    const collections = await mongoose.connection.db.listCollections({ name: 'csvrefunds' }).toArray();
    if (collections.length === 0) {
      console.log('No CSVRefund collection found. Migration not needed.');
      return;
    }

    // Get all CSV refunds
    const csvRefunds = await CSVRefund.find({}).populate('assignedTo uploadedBy');
    console.log(`Found ${csvRefunds.length} CSV refunds to migrate`);

    if (csvRefunds.length === 0) {
      console.log('No CSV refunds to migrate');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const csvRefund of csvRefunds) {
      try {
        // Check if this refund has already been migrated
        const existingAssignment = await RefundAssignment.findOne({
          source: 'csv',
          firstName: csvRefund.firstName,
          lastName: csvRefund.lastName,
          email: csvRefund.email,
          createdAt: csvRefund.createdAt
        });

        if (existingAssignment) {
          console.log(`Skipping already migrated refund: ${csvRefund.firstName} ${csvRefund.lastName}`);
          continue;
        }

        // Create new RefundAssignment with CSV source
        const newAssignment = new RefundAssignment({
          source: 'csv',
          
          // CSV-specific fields
          firstName: csvRefund.firstName,
          lastName: csvRefund.lastName,
          email: csvRefund.email,
          twoFA: csvRefund.twoFA,
          recoveryCodes: csvRefund.recoveryCodes,
          geo: csvRefund.geo,
          date: csvRefund.date,
          lastFourDigitsCard: csvRefund.lastFourDigitsCard,
          bank: csvRefund.bank,
          comment: csvRefund.comment,
          psp1: csvRefund.psp1,
          broker1: csvRefund.broker1,
          psp2: csvRefund.psp2,
          broker2: csvRefund.broker2,
          step1: csvRefund.step1,
          step2: csvRefund.step2,
          step3: csvRefund.step3,
          step4: csvRefund.step4,
          step5: csvRefund.step5,
          
          // Common fields
          assignedBy: csvRefund.uploadedBy, // uploadedBy becomes assignedBy
          refundsManager: csvRefund.assignedTo, // assignedTo becomes refundsManager
          status: csvRefund.status,
          notes: csvRefund.notes,
          statusHistory: csvRefund.statusHistory || [],
          assignedAt: csvRefund.createdAt, // Use creation date as assignment date
          
          // Preserve timestamps
          createdAt: csvRefund.createdAt,
          updatedAt: csvRefund.updatedAt
        });

        await newAssignment.save();
        migratedCount++;
        console.log(`Migrated: ${csvRefund.firstName} ${csvRefund.lastName} (${csvRefund.email})`);
        
      } catch (error) {
        errorCount++;
        console.error(`Error migrating refund ${csvRefund.firstName} ${csvRefund.lastName}:`, error.message);
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Successfully migrated: ${migratedCount} records`);
    console.log(`- Errors: ${errorCount} records`);
    console.log(`- Total processed: ${csvRefunds.length} records`);

    if (migratedCount > 0) {
      console.log('\n⚠️  IMPORTANT: After verifying the migration was successful, you can drop the old CSVRefund collection:');
      console.log('   db.csvrefunds.drop()');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await migrateCSVRefunds();
    console.log('\nMigration script completed successfully!');
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { migrateCSVRefunds };

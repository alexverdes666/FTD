const { validationResult } = require('express-validator');
const SalaryConfiguration = require('../models/SalaryConfiguration');
const AffiliateManagerMetrics = require('../models/AffiliateManagerMetrics');
const User = require('../models/User');

// Get all salary configurations (Admin only)
exports.getAllSalaryConfigurations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, salaryType } = req.query;
    const filter = {};
    
    if (salaryType) {
      filter.salaryType = salaryType;
    }
    
    const skip = (page - 1) * limit;
    const [configurations, total] = await Promise.all([
      SalaryConfiguration.find(filter)
        .populate('user', 'fullName email role')
        .populate('createdBy', 'fullName email')
        .populate('lastUpdatedBy', 'fullName email')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      SalaryConfiguration.countDocuments(filter)
    ]);
    
    res.status(200).json({
      success: true,
      data: configurations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get salary configuration by user ID
exports.getSalaryConfigurationByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Access control: Admins can access any user's data, affiliate managers can only access their own
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own salary configuration.'
      });
    }
    
    const configuration = await SalaryConfiguration.findOne({ 
      user: userId
    })
      .populate('user', 'fullName email role')
      .populate('createdBy', 'fullName email')
      .populate('lastUpdatedBy', 'fullName email');
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Salary configuration not found for this user'
      });
    }
    
    res.status(200).json({
      success: true,
      data: configuration
    });
  } catch (error) {
    next(error);
  }
};

// Create or update salary configuration
exports.createOrUpdateSalaryConfiguration = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }
    
    const { userId, salaryType, fixedSalary, affiliateManagerFormula, notes } = req.body;
    
    // Validate user exists and is an affiliate manager
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Salary configurations are only for affiliate managers
    if (user.role !== 'affiliate_manager') {
      return res.status(400).json({
        success: false,
        message: 'Salary configurations can only be created for affiliate managers'
      });
    }
    
    // Prepare configuration data
    const configData = {
      user: userId,
      salaryType,
      lastUpdatedBy: req.user._id,
      notes,
      isActive: true,
      effectiveDate: new Date()
    };
    
    // Set type-specific configuration
    if (salaryType === 'fixed_monthly') {
      configData.fixedSalary = fixedSalary;
    }
    
    // Use findOneAndUpdate with upsert to handle both create and update
    const configuration = await SalaryConfiguration.findOneAndUpdate(
      { user: userId },
      { 
        ...configData,
        // Only set createdBy if this is a new document
        $setOnInsert: { createdBy: req.user._id }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );
    
    await configuration.populate([
      { path: 'user', select: 'fullName email role' },
      { path: 'createdBy', select: 'fullName email' },
      { path: 'lastUpdatedBy', select: 'fullName email' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Salary configuration saved successfully',
      data: configuration
    });
  } catch (error) {
    next(error);
  }
};

// Calculate salary for a user
exports.calculateSalary = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, period = 'monthly' } = req.query;
    
    // Access control: Admins can access any user's data, affiliate managers can only access their own
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only calculate your own salary.'
      });
    }
    
    const configuration = await SalaryConfiguration.findOne({ 
      user: userId
    }).populate('user', 'fullName email role');
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Salary configuration not found for this user'
      });
    }
    
    // Ensure user is affiliate manager
    if (configuration.user.role !== 'affiliate_manager') {
      return res.status(400).json({
        success: false,
        message: 'Salary calculations are only available for affiliate managers'
      });
    }
    
    let salaryData = {};
    
    if (configuration.salaryType === 'fixed_monthly') {
      salaryData = await SalaryConfiguration.calculateFixedSalary(userId, period);
    }
    
    res.status(200).json({
      success: true,
      data: {
        user: configuration.user,
        salaryType: configuration.salaryType,
        calculation: salaryData,
        period: period,
        calculatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all users with salary configurations
exports.getUsersWithSalaryConfigurations = async (req, res, next) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.role': 'affiliate_manager' // Only affiliate managers
        }
      },
      {
        $project: {
          _id: 1,
          salaryType: 1,
          effectiveDate: 1,
          createdAt: 1,
          user: {
            _id: '$userInfo._id',
            fullName: '$userInfo.fullName',
            email: '$userInfo.email',
            role: '$userInfo.role'
          }
        }
      }
    ];
    
    const configurations = await SalaryConfiguration.aggregate(pipeline);
    
    res.status(200).json({
      success: true,
      data: configurations
    });
  } catch (error) {
    next(error);
  }
};

// Delete salary configuration
exports.deleteSalaryConfiguration = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const configuration = await SalaryConfiguration.findOneAndDelete(
      { user: userId }
    );
    
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Salary configuration not found for this user'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Salary configuration deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get salary statistics
exports.getSalaryStatistics = async (req, res, next) => {
  try {
    const stats = await SalaryConfiguration.aggregate([
      {
        $group: {
          _id: '$salaryType',
          count: { $sum: 1 },
          avgFixedSalary: {
            $avg: {
              $cond: [
                { $eq: ['$salaryType', 'fixed_monthly'] },
                '$fixedSalary.amount',
                null
              ]
            }
          },

        }
      }
    ]);
    
    const totalConfigurations = await SalaryConfiguration.countDocuments();
    
    res.status(200).json({
      success: true,
      data: {
        totalConfigurations,
        byType: stats
      }
    });
  } catch (error) {
    next(error);
  }
}; 
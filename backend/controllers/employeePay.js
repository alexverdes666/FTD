const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const EmployeeSalary = require('../models/EmployeeSalary');
const EmployeeBonus = require('../models/EmployeeBonus');
const AgentFine = require('../models/AgentFine');

const canAccess = (req, employeeId) => {
  return req.user.role === 'admin' || req.user._id.toString() === employeeId;
};

// --- Salary (fixed per employee) ---

exports.getEmployeeSalary = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    if (!canAccess(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const salary = await EmployeeSalary.findOne({ employee: employeeId })
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email')
      .populate('lastUpdatedBy', 'fullName email');

    res.json({ success: true, data: salary });
  } catch (error) {
    next(error);
  }
};

exports.getAllEmployeeSalaries = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const employees = await User.find({ role: 'employee', isActive: true })
      .select('fullName email')
      .sort({ fullName: 1 });

    const salaries = await EmployeeSalary.find({
      employee: { $in: employees.map((e) => e._id) },
    })
      .populate('employee', 'fullName email role')
      .populate('lastUpdatedBy', 'fullName email');

    // Merge: show all employees, with or without salary
    const result = employees.map((emp) => {
      const sal = salaries.find((s) => s.employee._id.toString() === emp._id.toString());
      return {
        employee: emp,
        salary: sal || null,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.setEmployeeSalary = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { employeeId } = req.params;
    const { amount, currency, notes } = req.body;

    const salary = await EmployeeSalary.findOneAndUpdate(
      { employee: employeeId },
      {
        employee: employeeId,
        amount,
        currency: currency || 'USD',
        notes,
        lastUpdatedBy: req.user._id,
        $setOnInsert: { createdBy: req.user._id },
      },
      { new: true, upsert: true, runValidators: true }
    )
      .populate('employee', 'fullName email role')
      .populate('lastUpdatedBy', 'fullName email');

    res.json({ success: true, data: salary });
  } catch (error) {
    next(error);
  }
};

exports.deleteEmployeeSalary = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const salary = await EmployeeSalary.findOneAndDelete({ employee: employeeId });
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary not found' });
    }
    res.json({ success: true, message: 'Salary deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Bonus (per month) ---

exports.getEmployeeBonuses = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    if (!canAccess(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { year, month } = req.query;
    const filter = { employee: employeeId };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const bonuses = await EmployeeBonus.find(filter)
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email')
      .sort({ year: -1, month: -1, createdAt: -1 });

    res.json({ success: true, data: bonuses });
  } catch (error) {
    next(error);
  }
};

exports.createEmployeeBonus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { employeeId, amount, reason, currency, month, year, notes } = req.body;

    const bonus = await EmployeeBonus.create({
      employee: employeeId,
      amount,
      reason,
      currency: currency || 'USD',
      month,
      year,
      notes,
      createdBy: req.user._id,
    });

    const populated = await EmployeeBonus.findById(bonus._id)
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployeeBonus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const bonus = await EmployeeBonus.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email');

    if (!bonus) {
      return res.status(404).json({ success: false, message: 'Bonus not found' });
    }

    res.json({ success: true, data: bonus });
  } catch (error) {
    next(error);
  }
};

exports.deleteEmployeeBonus = async (req, res, next) => {
  try {
    const bonus = await EmployeeBonus.findByIdAndDelete(req.params.id);
    if (!bonus) {
      return res.status(404).json({ success: false, message: 'Bonus not found' });
    }
    res.json({ success: true, message: 'Bonus deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Summary ---

exports.getEmployeePaySummary = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    if (!canAccess(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { year, month } = req.query;

    const [salary, bonusAgg, finesAgg] = await Promise.all([
      EmployeeSalary.findOne({ employee: employeeId }),
      EmployeeBonus.aggregate([
        {
          $match: {
            employee: new mongoose.Types.ObjectId(employeeId),
            ...(year && { year: parseInt(year) }),
            ...(month && { month: parseInt(month) }),
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      AgentFine.getTotalActiveFines(
        employeeId,
        year ? parseInt(year) : null,
        month ? parseInt(month) : null
      ),
    ]);

    const fixedSalary = salary?.amount || 0;
    const totalBonuses = bonusAgg[0]?.total || 0;
    const totalFines = finesAgg[0]?.totalFines || 0;

    res.json({
      success: true,
      data: {
        fixedSalary,
        totalBonuses,
        bonusCount: bonusAgg[0]?.count || 0,
        totalFines,
        netPay: fixedSalary + totalBonuses - totalFines,
      },
    });
  } catch (error) {
    next(error);
  }
};

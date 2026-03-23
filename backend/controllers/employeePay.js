const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const EmployeeSalary = require('../models/EmployeeSalary');
const EmployeeBonus = require('../models/EmployeeBonus');
const AgentFine = require('../models/AgentFine');

// Access check: admin or own data
const canAccess = (req, employeeId) => {
  return req.user.role === 'admin' || req.user._id.toString() === employeeId;
};

// --- Salary ---

exports.getEmployeeSalaries = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    if (!canAccess(req, employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { year, month } = req.query;
    const filter = { employee: employeeId };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const salaries = await EmployeeSalary.find(filter)
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email')
      .sort({ year: -1, month: -1, createdAt: -1 });

    res.json({ success: true, data: salaries });
  } catch (error) {
    next(error);
  }
};

exports.createEmployeeSalary = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { employeeId, amount, currency, month, year, notes } = req.body;

    const salary = await EmployeeSalary.create({
      employee: employeeId,
      amount,
      currency: currency || 'USD',
      month,
      year,
      notes,
      createdBy: req.user._id,
    });

    const populated = await EmployeeSalary.findById(salary._id)
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployeeSalary = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const salary = await EmployeeSalary.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('employee', 'fullName email role')
      .populate('createdBy', 'fullName email');

    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    res.json({ success: true, data: salary });
  } catch (error) {
    next(error);
  }
};

exports.deleteEmployeeSalary = async (req, res, next) => {
  try {
    const salary = await EmployeeSalary.findByIdAndDelete(req.params.id);
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }
    res.json({ success: true, message: 'Salary record deleted' });
  } catch (error) {
    next(error);
  }
};

// --- Bonus ---

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
      return res.status(404).json({ success: false, message: 'Bonus record not found' });
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
      return res.status(404).json({ success: false, message: 'Bonus record not found' });
    }
    res.json({ success: true, message: 'Bonus record deleted' });
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
    const filter = { employee: new mongoose.Types.ObjectId(employeeId) };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const [salaries, bonuses, finesAgg] = await Promise.all([
      EmployeeSalary.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      EmployeeBonus.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      AgentFine.getTotalActiveFines(
        employeeId,
        year ? parseInt(year) : null,
        month ? parseInt(month) : null
      ),
    ]);

    const totalSalary = salaries[0]?.total || 0;
    const totalBonuses = bonuses[0]?.total || 0;
    const totalFines = finesAgg[0]?.totalFines || 0;

    res.json({
      success: true,
      data: {
        totalSalary,
        salaryCount: salaries[0]?.count || 0,
        totalBonuses,
        bonusCount: bonuses[0]?.count || 0,
        totalFines,
        netPay: totalSalary + totalBonuses - totalFines,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllEmployeesPaySummary = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { year, month } = req.query;

    const employees = await User.find({ role: 'employee', isActive: true })
      .select('fullName email')
      .sort({ fullName: 1 });

    const summaries = await Promise.all(
      employees.map(async (emp) => {
        const filter = { employee: emp._id };
        if (year) filter.year = parseInt(year);
        if (month) filter.month = parseInt(month);

        const [salaries, bonuses, finesAgg] = await Promise.all([
          EmployeeSalary.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
          EmployeeBonus.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
          AgentFine.getTotalActiveFines(
            emp._id.toString(),
            year ? parseInt(year) : null,
            month ? parseInt(month) : null
          ),
        ]);

        const totalSalary = salaries[0]?.total || 0;
        const totalBonuses = bonuses[0]?.total || 0;
        const totalFines = finesAgg[0]?.totalFines || 0;

        return {
          employee: emp,
          totalSalary,
          totalBonuses,
          totalFines,
          netPay: totalSalary + totalBonuses - totalFines,
        };
      })
    );

    res.json({ success: true, data: summaries });
  } catch (error) {
    next(error);
  }
};

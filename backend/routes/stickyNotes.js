const express = require("express");
const router = express.Router();
const {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} = require("../controllers/stickyNotes");

const { protect } = require("../middleware/auth");

router.use(protect);

router.route("/").get(getNotes).post(createNote);

router.route("/:id").put(updateNote).delete(deleteNote);

module.exports = router;

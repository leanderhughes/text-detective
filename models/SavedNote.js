const mongoose = require('mongoose');

const NoteSchema = require('./NoteSchema');

const Note = mongoose.model('SavedNote',NoteSchema);

module.exports = Note;


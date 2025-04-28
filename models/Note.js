const mongoose = require('mongoose');

const NoteSchema = require('./NoteSchema');

const Note = mongoose.model('Note',NoteSchema);

module.exports = Note;


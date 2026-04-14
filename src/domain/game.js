import { SUDOKU_SIZE, createSudokuFromJSON, normalizeMove } from './sudoku.js';

const GAME_TYPE = 'game';
const GAME_VERSION = 1;

function assertHistoryValue(value, label) {
	if (!Number.isInteger(value) || value < 0 || value > SUDOKU_SIZE) {
		throw new TypeError(`${label} must be an integer from 0 to 9.`);
	}
}

function assertHistoryPosition(value, label) {
	if (!Number.isInteger(value) || value < 0 || value >= SUDOKU_SIZE) {
		throw new TypeError(`${label} must be an integer from 0 to 8.`);
	}
}

function assertHistoryEntry(entry) {
	if (!entry || typeof entry !== 'object') {
		throw new TypeError('History entries must be objects.');
	}

	const { row, col, before, after } = entry;
	assertHistoryPosition(row, 'History row');
	assertHistoryPosition(col, 'History col');
	assertHistoryValue(before, 'History before');
	assertHistoryValue(after, 'History after');

	return { row, col, before, after };
}

function cloneHistoryEntry(entry) {
	const normalized = assertHistoryEntry(entry);
	return {
		row: normalized.row,
		col: normalized.col,
		before: normalized.before,
		after: normalized.after,
	};
}

function cloneHistory(history) {
	if (history === undefined) {
		return [];
	}

	if (!Array.isArray(history)) {
		throw new TypeError('History must be an array.');
	}

	return history.map(cloneHistoryEntry);
}

export function createGame({ sudoku, undoStack = [], redoStack = [] } = {}) {
	if (!sudoku
		|| typeof sudoku.clone !== 'function'
		|| typeof sudoku.guess !== 'function'
		|| typeof sudoku.getCell !== 'function'
		|| typeof sudoku.getGrid !== 'function'
		|| typeof sudoku.toJSON !== 'function') {
		throw new TypeError('createGame requires a Sudoku-like object.');
	}

	let currentSudoku = sudoku.clone();
	let undoHistory = cloneHistory(undoStack);
	let redoHistory = cloneHistory(redoStack);

	function readCell(row, col) {
		return currentSudoku.getCell(row, col);
	}

	function applyValue(row, col, value) {
		return currentSudoku.guess({ row, col, value });
	}

	return {
		getSudoku() {
			return currentSudoku.clone();
		},

		guess(move) {
			const { row, col, value } = normalizeMove(move);
			const before = readCell(row, col);

			if (before === value) {
				return false;
			}

			const changed = applyValue(row, col, value);
			if (!changed) {
				return false;
			}

			const after = readCell(row, col);
			undoHistory.push({ row, col, before, after });
			redoHistory = [];
			return true;
		},

		undo() {
			if (undoHistory.length === 0) {
				return false;
			}

			const entry = undoHistory.pop();
			applyValue(entry.row, entry.col, entry.before);
			redoHistory.push(cloneHistoryEntry(entry));
			return true;
		},

		redo() {
			if (redoHistory.length === 0) {
				return false;
			}

			const entry = redoHistory.pop();
			applyValue(entry.row, entry.col, entry.after);
			undoHistory.push(cloneHistoryEntry(entry));
			return true;
		},

		canUndo() {
			return undoHistory.length > 0;
		},

		canRedo() {
			return redoHistory.length > 0;
		},

		toJSON() {
			return {
				type: GAME_TYPE,
				version: GAME_VERSION,
				sudoku: currentSudoku.toJSON(),
				undoStack: cloneHistory(undoHistory),
				redoStack: cloneHistory(redoHistory),
			};
		},
	};
}

export function createGameFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new TypeError('Game JSON must be an object.');
	}

	if (json.type !== GAME_TYPE) {
		throw new TypeError('Game JSON must have type "game".');
	}

	if (json.version !== GAME_VERSION) {
		throw new TypeError('Game JSON has an unsupported version.');
	}

	if (!json.sudoku) {
		throw new TypeError('Game JSON must contain a sudoku field.');
	}

	return createGame({
		sudoku: createSudokuFromJSON(json.sudoku),
		undoStack: json.undoStack,
		redoStack: json.redoStack,
	});
}

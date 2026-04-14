const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;
const SUDOKU_TYPE = 'sudoku';
const SUDOKU_VERSION = 1;

function assertCellValue(cell) {
	if (!Number.isInteger(cell)) {
		throw new TypeError('Sudoku cells must be integers.');
	}

	if (cell < 0 || cell > SUDOKU_SIZE) {
		throw new TypeError('Sudoku cells must be integers from 0 to 9.');
	}
}

function assertGridShape(grid, label = 'Sudoku grid') {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new TypeError(`${label} must be a 9x9 number matrix.`);
	}

	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
			throw new TypeError(`${label} must be a 9x9 number matrix.`);
		}

		for (const cell of row) {
			assertCellValue(cell);
		}
	}
}

function assertPosition(row, col) {
	if (!Number.isInteger(row) || row < 0 || row >= SUDOKU_SIZE) {
		throw new TypeError('Move row must be an integer from 0 to 8.');
	}

	if (!Number.isInteger(col) || col < 0 || col >= SUDOKU_SIZE) {
		throw new TypeError('Move col must be an integer from 0 to 8.');
	}
}

function cloneGrid(grid) {
	return grid.map(row => row.slice());
}

function normalizeMove(move) {
	const { row, col, value } = move ?? {};

	assertPosition(row, col);
	assertCellValue(value);

	return { row, col, value };
}

function normalizeInitialGrid(grid, initialGrid) {
	if (initialGrid === undefined) {
		return cloneGrid(grid);
	}

	assertGridShape(initialGrid, 'Sudoku initial grid');
	return cloneGrid(initialGrid);
}

function isFixedCell(initialGrid, row, col) {
	return initialGrid[row][col] !== 0;
}

function markDuplicates(cells, invalid) {
	if (cells.length < 2) {
		return;
	}

	for (const [row, col] of cells) {
		invalid.add(`${row},${col}`);
	}
}

function getInvalidCellsForGrid(grid) {
	const invalid = new Set();

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		const seen = new Map();
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const value = grid[row][col];
			if (value === 0) {
				continue;
			}

			const cells = seen.get(value) ?? [];
			cells.push([row, col]);
			seen.set(value, cells);
		}

		for (const cells of seen.values()) {
			markDuplicates(cells, invalid);
		}
	}

	for (let col = 0; col < SUDOKU_SIZE; col++) {
		const seen = new Map();
		for (let row = 0; row < SUDOKU_SIZE; row++) {
			const value = grid[row][col];
			if (value === 0) {
				continue;
			}

			const cells = seen.get(value) ?? [];
			cells.push([row, col]);
			seen.set(value, cells);
		}

		for (const cells of seen.values()) {
			markDuplicates(cells, invalid);
		}
	}

	for (let boxRow = 0; boxRow < SUDOKU_SIZE; boxRow += BOX_SIZE) {
		for (let boxCol = 0; boxCol < SUDOKU_SIZE; boxCol += BOX_SIZE) {
			const seen = new Map();
			for (let row = boxRow; row < boxRow + BOX_SIZE; row++) {
				for (let col = boxCol; col < boxCol + BOX_SIZE; col++) {
					const value = grid[row][col];
					if (value === 0) {
						continue;
					}

					const cells = seen.get(value) ?? [];
					cells.push([row, col]);
					seen.set(value, cells);
				}
			}

			for (const cells of seen.values()) {
				markDuplicates(cells, invalid);
			}
		}
	}

	return Array.from(invalid)
		.map((key) => {
			const [row, col] = key.split(',').map(Number);
			return { row, col };
		})
		.sort((left, right) => left.row - right.row || left.col - right.col);
}

function formatGrid(grid) {
	const rows = [];

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		if (row !== 0 && row % BOX_SIZE === 0) {
			rows.push('------+-------+------');
		}

		const groups = [];
		for (let col = 0; col < SUDOKU_SIZE; col += BOX_SIZE) {
			groups.push(
				grid[row]
					.slice(col, col + BOX_SIZE)
					.map(value => (value === 0 ? '.' : String(value)))
					.join(' '),
			);
		}

		rows.push(groups.join(' | '));
	}

	return rows.join('\n');
}

export function createSudoku(input, options = {}) {
	assertGridShape(input);

	const initialGrid = normalizeInitialGrid(input, options.initialGrid);
	let grid = cloneGrid(input);

	return {
		getGrid() {
			return cloneGrid(grid);
		},

		getCell(row, col) {
			assertPosition(row, col);
			return grid[row][col];
		},

		isFixed(row, col) {
			assertPosition(row, col);
			return isFixedCell(initialGrid, row, col);
		},

		guess(move) {
			const { row, col, value } = normalizeMove(move);

			if (isFixedCell(initialGrid, row, col) || grid[row][col] === value) {
				return false;
			}

			grid[row][col] = value;
			return true;
		},

		getInvalidCells() {
			return getInvalidCellsForGrid(grid);
		},

		isSolved() {
			return !grid.some(row => row.includes(0)) && getInvalidCellsForGrid(grid).length === 0;
		},

		clone() {
			return createSudoku(grid, { initialGrid });
		},

		toJSON() {
			return {
				type: SUDOKU_TYPE,
				version: SUDOKU_VERSION,
				grid: cloneGrid(grid),
				initialGrid: cloneGrid(initialGrid),
			};
		},

		toString() {
			return formatGrid(grid);
		},
	};
}

export function createSudokuFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new TypeError('Sudoku JSON must be an object.');
	}

	if (json.type !== SUDOKU_TYPE) {
		throw new TypeError('Sudoku JSON must have type "sudoku".');
	}

	if (json.version !== SUDOKU_VERSION) {
		throw new TypeError('Sudoku JSON has an unsupported version.');
	}

	if (!('grid' in json)) {
		throw new TypeError('Sudoku JSON must contain a grid field.');
	}

	return createSudoku(json.grid, { initialGrid: json.initialGrid });
}

export { BOX_SIZE, SUDOKU_SIZE, cloneGrid, getInvalidCellsForGrid, normalizeMove };

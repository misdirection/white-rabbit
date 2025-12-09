/**
 * @file formatting.js
 * @description Number and scientific formatting utilities for display across the application.
 *
 * Provides consistent formatting of numbers, scientific notation, and physical units
 * used throughout the UI (tooltips, info windows, debug displays).
 *
 * Key features:
 * - Smart decimal formatting based on magnitude
 * - Scientific notation with unicode superscripts (e.g., 1.23 × 10⁵)
 * - Physical unit conversion (gravity m/s² → g-units)
 * - Locale-aware number formatting
 */

/**
 * Formats a number in scientific notation using unicode superscripts.
 * Example: 1.23e5 → "1.23 × 10⁵"
 * Automatically removes trailing zeros from the coefficient.
 *
 * @param {number} value - The value to format
 * @param {number} precision - Decimal places for the coefficient (default: 2)
 * @returns {string} Formatted string
 */
export function formatScientific(value, precision = 2) {
	if (!value) return '0';

	// Get exponential string e.g. "1.23e+5"
	const expStr = value.toExponential(precision);
	const [coeffStr, exponentStr] = expStr.split('e');

	// Clean coefficient: parseFloat removes trailing zeros e.g. "3.00" -> 3
	const coeff = parseFloat(coeffStr);

	// Convert exponent to superscripts
	const exponent = parseInt(exponentStr);
	const superscripts = {
		0: '⁰',
		1: '¹',
		2: '²',
		3: '³',
		4: '⁴',
		5: '⁵',
		6: '⁶',
		7: '⁷',
		8: '⁸',
		9: '⁹',
		'-': '⁻',
		'+': '',
	};

	const exponentFormatted = exponent
		.toString()
		.split('')
		.map((char) => superscripts[char] || char)
		.join('');

	return `${coeff} × 10${exponentFormatted}`;
}

/**
 * Smart decimal formatter with magnitude-aware precision:
 * - value >= 1000: No decimals (e.g., "1,234")
 * - value >= 10: 1 decimal (e.g., "12.3")
 * - value < 10: up to 3 decimals (e.g., "1.234")
 *
 * Uses locale-aware formatting with thousands separators.
 *
 * @param {number} value - The value to format
 * @returns {string} Formatted string with appropriate precision
 */
export function formatDecimal(value) {
	if (typeof value !== 'number') return value;

	const absVal = Math.abs(value);

	if (absVal >= 1000) {
		return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	if (absVal >= 10) {
		return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
	}
	// For very small numbers, up to 3 decimals for precision
	return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/**
 * Converts gravity values to g-units (Earth gravities).
 * Handles both string values with units (passthrough) and numeric m/s² values.
 * 1 g = 9.807 m/s²
 *
 * @param {string|number} value - Gravity value (either "0.38 g" or 3.72 for m/s²)
 * @returns {string} Formatted string with g-units
 */
export function formatGravity(value) {
	if (!value) return 'N/A';

	// If already has units, return as-is (most planet data uses this format)
	if (typeof value === 'string') {
		return value;
	}

	// Convert m/s² to g-units
	if (typeof value === 'number') {
		const gVal = value / 9.807;
		return `${gVal.toFixed(2)} g`;
	}

	return value;
}

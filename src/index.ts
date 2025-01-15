import { codeFrameColumns } from '@babel/code-frame';
import indexToPosition, {
    LineColumnPosition
} from '@smushytaco/index-to-position';
import type { JsonValue } from 'type-fest';

/**
 * Get the Unicode code point representation of a character.
 *
 * @param character - The character to convert.
 * @returns The Unicode code point as a string.
 */
const getCodePoint = (character: string): string =>
    `\\u{${(character.codePointAt(0) ?? 0).toString(16)}}`;

/**
 * Custom JSON parsing error class.
 */
export class JSONError extends Error {
    /**
     * Custom JSON parsing error class.
     */
    name = 'JSONError';
    /**
     * The filename displayed in the error message, if any.
     */
    fileName?: string;
    /**
     * The printable section of the JSON which produces the error.
     */
    readonly codeFrame?: string;
    /**
     * The raw version of `codeFrame` without colors.
     */
    readonly rawCodeFrame?: string;
    /**
     * The base error message.
     */
    #message: string;
    /**
     * Creates a new `JSONError` instance.
     *
     * @param message - The error message.
     * @param jsonString - The JSON string where the error occurred.
     * @param location - The line and column position of the error in the JSON string, if available.
     */
    constructor(
        message: string,
        jsonString?: string,
        location?: LineColumnPosition
    ) {
        super();
        this.#message = message;
        if (jsonString && location) {
            this.codeFrame = generateCodeFrame(jsonString, location);
            this.rawCodeFrame = generateCodeFrame(jsonString, location, false);
        }
        Error.captureStackTrace?.(this, JSONError);
    }
    /**
     * Gets the error message, including file name and code frame if available.
     */
    get message(): string {
        const { fileName, codeFrame } = this;

        let locationInfo = '';
        if (fileName) {
            locationInfo = ` in ${fileName}`;
        }

        let frameInfo = '';
        if (codeFrame) {
            frameInfo = `\n\n${codeFrame}\n`;
        }

        return this.#message + locationInfo + frameInfo;
    }
    /**
     * Sets the base error message.
     *
     * @param message - The new error message.
     */
    set message(message: string) {
        this.#message = message;
    }
}

/**
 * Generate a code frame for a given string and location.
 *
 * @param string - The JSON string.
 * @param location - The error location.
 * @param highlightCode - Whether to highlight the code.
 * @returns A code frame string.
 */
const generateCodeFrame = (
    string: string,
    location: LineColumnPosition,
    highlightCode = true
): string => codeFrameColumns(string, { start: location }, { highlightCode });

/**
 * Extract the error location from a JSON parsing error message.
 *
 * @param string - The JSON string.
 * @param message - The error message.
 * @returns The error location, or undefined if not found.
 */
const getErrorLocation = (
    string: string,
    message: string
): LineColumnPosition | undefined => {
    const match = RegExp(
        /in JSON at position (?<index>\d+)(?: \(line (?<line>\d+) column (?<column>\d+)\))?$/
    ).exec(message);

    if (!match?.groups) return undefined;

    let { index, line, column } = match.groups;

    if (line && column) {
        return { line: Number(line), column: Number(column) };
    }

    const parsedIndex = Number(index);
    if (parsedIndex === string.length) {
        const { line, column } = indexToPosition(string, string.length - 1, {
            oneBased: true
        });
        return { line, column: column + 1 };
    }

    return indexToPosition(string, parsedIndex, { oneBased: true });
};

/**
 * Enhance an unexpected token error message with the code point.
 *
 * @param message - The error message.
 * @returns The enhanced error message.
 */
const addCodePointToUnexpectedToken = (message: string): string =>
    message.replace(
        // TODO[engine:node@>=20]: The token always quoted after Node.js 20
        /(?<=^Unexpected token )(?<quote>')?(.)\k<quote>/,
        (_, _quote, token) => `"${token}"(${getCodePoint(token)})`
    );

/**
 * The `reviver` parameter from `JSON.parse`, which prescribes how the value originally produced by parsing is transformed, before being returned.
 *
 * @example
 * ```
 * const json = '{"a": 1, "b": 2}';
 * const reviver: Reviver = (key, value) => key === 'a' ? value * 2 : value;
 * console.log(JSON.parse(json, reviver));
 * //=> { a: 2, b: 2 }
 * ```
 */
export type Reviver = Parameters<(typeof JSON)['parse']>[1];

// noinspection JSUnusedGlobalSymbols
/**
 * Parse JSON with more helpful errors.
 *
 * @param string - A valid JSON string.
 * @param reviver - The transformation function.
 * @param fileName - The filename for error messages.
 * @returns A parsed JSON object.
 * @throws A {@link JSONError} when there is a parsing error.
 */
export function parseJson(
    string: string,
    reviver?: Reviver,
    fileName?: string
): JsonValue {
    let message: string;

    try {
        return JSON.parse(string, reviver);
    } catch (error) {
        if (error instanceof Error) {
            message = error.message;
        } else {
            throw error;
        }
    }

    let location: LineColumnPosition | undefined;
    if (string) {
        location = getErrorLocation(string, message);
        message = addCodePointToUnexpectedToken(message);
    } else {
        message += ' while parsing empty string';
    }

    const jsonError = new JSONError(message, string, location);
    jsonError.fileName = fileName;

    throw jsonError;
}

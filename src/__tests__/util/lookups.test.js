/**
 * Unit tests for src/lib/util/qseow/lookups.js
 *
 * Tests the lookup maps and column header positioning functions used for:
 * - Task type/status mapping (numeric <-> string conversion)
 * - CSV/Excel file column position detection
 * - App import column mapping
 *
 * These are pure utility functions that don't require live Qlik connection.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import {
    mapDaylightSavingTime,
    mapEventType,
    mapIncrementOption,
    mapRuleState,
    mapTaskExecutionStatus,
    mapTaskType,
    taskFileColumnHeaders,
    appFileColumnHeaders,
    getTaskColumnPosFromHeaderRow,
    getAppColumnPosFromHeaderRow,
} from '../../lib/util/qseow/lookups.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

/**
 * Tests for mapDaylightSavingTime - bidirectional mapping between numeric codes and DST status strings
 * Used in schema/calendar configuration for task schedules
 */
describe('mapDaylightSavingTime', () => {
    test('should have correct number of entries', () => {
        expect(mapDaylightSavingTime.size).toBe(6);
    });

    test('should map numeric values to strings', () => {
        expect(mapDaylightSavingTime.get(0)).toBe('ObserveDaylightSavingTime');
        expect(mapDaylightSavingTime.get(1)).toBe('PermanentStandardTime');
        expect(mapDaylightSavingTime.get(2)).toBe('PermanentDaylightSavingTime');
    });

    test('should map string values to numbers', () => {
        expect(mapDaylightSavingTime.get('ObserveDaylightSavingTime')).toBe(0);
        expect(mapDaylightSavingTime.get('PermanentStandardTime')).toBe(1);
        expect(mapDaylightSavingTime.get('PermanentDaylightSavingTime')).toBe(2);
    });

    test('should return undefined for unknown values', () => {
        expect(mapDaylightSavingTime.get(99)).toBeUndefined();
        expect(mapDaylightSavingTime.get('Unknown')).toBeUndefined();
    });
});

/**
 * Tests for mapEventType - bidirectional mapping for event types (Schema/Composite)
 * Used in task event handling
 */
describe('mapEventType', () => {
    test('should have correct number of entries', () => {
        expect(mapEventType.size).toBe(4);
    });

    test('should map numeric values to strings', () => {
        expect(mapEventType.get(0)).toBe('Schema');
        expect(mapEventType.get(1)).toBe('Composite');
    });

    test('should map string values to numbers', () => {
        expect(mapEventType.get('Schema')).toBe(0);
        expect(mapEventType.get('Composite')).toBe(1);
    });
});

/**
 * Tests for mapIncrementOption - bidirectional mapping for schema increment options
 * Values: once, hourly, daily, weekly, monthly, custom
 */
describe('mapIncrementOption', () => {
    test('should have correct number of entries', () => {
        expect(mapIncrementOption.size).toBe(12);
    });

    test('should map numeric values to strings', () => {
        expect(mapIncrementOption.get(0)).toBe('once');
        expect(mapIncrementOption.get(1)).toBe('hourly');
        expect(mapIncrementOption.get(2)).toBe('daily');
        expect(mapIncrementOption.get(3)).toBe('weekly');
        expect(mapIncrementOption.get(4)).toBe('monthly');
        expect(mapIncrementOption.get(5)).toBe('custom');
    });

    test('should map string values to numbers', () => {
        expect(mapIncrementOption.get('once')).toBe(0);
        expect(mapIncrementOption.get('hourly')).toBe(1);
        expect(mapIncrementOption.get('daily')).toBe(2);
        expect(mapIncrementOption.get('weekly')).toBe(3);
        expect(mapIncrementOption.get('monthly')).toBe(4);
        expect(mapIncrementOption.get('custom')).toBe(5);
    });
});

/**
 * Tests for mapRuleState - bidirectional mapping for rule state
 * Values: Undefined, TaskSuccessful, TaskFail
 */
describe('mapRuleState', () => {
    test('should have correct number of entries', () => {
        expect(mapRuleState.size).toBe(6);
    });

    test('should map numeric values to strings', () => {
        expect(mapRuleState.get(0)).toBe('Undefined');
        expect(mapRuleState.get(1)).toBe('TaskSuccessful');
        expect(mapRuleState.get(2)).toBe('TaskFail');
    });

    test('should map string values to numbers', () => {
        expect(mapRuleState.get('Undefined')).toBe(0);
        expect(mapRuleState.get('TaskSuccessful')).toBe(1);
        expect(mapRuleState.get('TaskFail')).toBe(2);
    });
});

/**
 * Tests for mapTaskExecutionStatus - bidirectional mapping for task execution status codes
 * Full mapping: 0=NeverStarted through 12=Reset
 * Critical for task monitoring and state display
 */
describe('mapTaskExecutionStatus', () => {
    test('should have correct number of entries', () => {
        expect(mapTaskExecutionStatus.size).toBeGreaterThan(0);
    });

    test('should map all numeric status codes', () => {
        expect(mapTaskExecutionStatus.get(0)).toBe('NeverStarted');
        expect(mapTaskExecutionStatus.get(1)).toBe('Triggered');
        expect(mapTaskExecutionStatus.get(2)).toBe('Started');
        expect(mapTaskExecutionStatus.get(3)).toBe('Queued');
        expect(mapTaskExecutionStatus.get(4)).toBe('AbortInitiated');
        expect(mapTaskExecutionStatus.get(5)).toBe('Aborting');
        expect(mapTaskExecutionStatus.get(6)).toBe('Aborted');
        expect(mapTaskExecutionStatus.get(7)).toBe('FinishedSuccess');
        expect(mapTaskExecutionStatus.get(8)).toBe('FinishedFail');
        expect(mapTaskExecutionStatus.get(9)).toBe('Skipped');
        expect(mapTaskExecutionStatus.get(10)).toBe('Retry');
        expect(mapTaskExecutionStatus.get(11)).toBe('Error');
        expect(mapTaskExecutionStatus.get(12)).toBe('Reset');
    });

    test('should map all string status names', () => {
        expect(mapTaskExecutionStatus.get('NeverStarted')).toBe(0);
        expect(mapTaskExecutionStatus.get('Triggered')).toBe(1);
        expect(mapTaskExecutionStatus.get('Started')).toBe(2);
        expect(mapTaskExecutionStatus.get('Queued')).toBe(3);
        expect(mapTaskExecutionStatus.get('AbortInitiated')).toBe(4);
        expect(mapTaskExecutionStatus.get('Aborting')).toBe(5);
        expect(mapTaskExecutionStatus.get('Aborted')).toBe(6);
        expect(mapTaskExecutionStatus.get('FinishedSuccess')).toBe(7);
        expect(mapTaskExecutionStatus.get('FinishedFail')).toBe(8);
        expect(mapTaskExecutionStatus.get('Skipped')).toBe(9);
        expect(mapTaskExecutionStatus.get('Retry')).toBe(10);
        expect(mapTaskExecutionStatus.get('Error')).toBe(11);
        expect(mapTaskExecutionStatus.get('Reset')).toBe(11);
    });
});

/**
 * Tests for mapTaskType - bidirectional mapping for task types
 * Values: Reload, ExternalProgram, UserSync, Distribute
 */
describe('mapTaskType', () => {
    test('should have correct number of entries', () => {
        expect(mapTaskType.size).toBe(8);
    });

    test('should map numeric values to strings', () => {
        expect(mapTaskType.get(0)).toBe('Reload');
        expect(mapTaskType.get(1)).toBe('ExternalProgram');
        expect(mapTaskType.get(2)).toBe('UserSync');
        expect(mapTaskType.get(3)).toBe('Distribute');
    });

    test('should map string values to numbers', () => {
        expect(mapTaskType.get('Reload')).toBe(0);
        expect(mapTaskType.get('ExternalProgram')).toBe(1);
        expect(mapTaskType.get('UserSync')).toBe(2);
        expect(mapTaskType.get('Distribute')).toBe(3);
    });
});

/**
 * Tests for taskFileColumnHeaders - column header definitions for task import CSV/Excel files
 * Each property has { name: string, pos: number } where pos=-1 means not found
 */
describe('taskFileColumnHeaders', () => {
    test('should have correct initial structure', () => {
        expect(taskFileColumnHeaders).toBeDefined();
        expect(taskFileColumnHeaders.taskName).toBeDefined();
        expect(taskFileColumnHeaders.taskName.name).toBe('Task name');
        expect(taskFileColumnHeaders.taskName.pos).toBe(-1);
    });

    test('should have all required properties', () => {
        expect(taskFileColumnHeaders.taskCounter).toBeDefined();
        expect(taskFileColumnHeaders.taskType).toBeDefined();
        expect(taskFileColumnHeaders.taskName).toBeDefined();
        expect(taskFileColumnHeaders.taskId).toBeDefined();
        expect(taskFileColumnHeaders.taskEnabled).toBeDefined();
        expect(taskFileColumnHeaders.appName).toBeDefined();
        expect(taskFileColumnHeaders.taskStatus).toBeDefined();
        expect(taskFileColumnHeaders.taskTags).toBeDefined();
    });

    test('all properties should have name and pos', () => {
        Object.values(taskFileColumnHeaders).forEach((header) => {
            expect(header).toHaveProperty('name');
            expect(header).toHaveProperty('pos');
            expect(header.pos).toBe(-1);
        });
    });
});

/**
 * Tests for appFileColumnHeaders - column header definitions for app import files
 * Supports QVF directory, name, tags, custom properties
 */
describe('appFileColumnHeaders', () => {
    test('should have correct initial structure', () => {
        expect(appFileColumnHeaders).toBeDefined();
        expect(appFileColumnHeaders.appName).toBeDefined();
        expect(appFileColumnHeaders.appName.name).toBe('App name');
        expect(appFileColumnHeaders.appName.pos).toBe(-1);
    });

    test('should have all required properties', () => {
        expect(appFileColumnHeaders.appCounter).toBeDefined();
        expect(appFileColumnHeaders.appName).toBeDefined();
        expect(appFileColumnHeaders.qvfDirectory).toBeDefined();
        expect(appFileColumnHeaders.qvfName).toBeDefined();
        expect(appFileColumnHeaders.appTags).toBeDefined();
    });

    test('all properties should have name and pos', () => {
        Object.values(appFileColumnHeaders).forEach((header) => {
            expect(header).toHaveProperty('name');
            expect(header).toHaveProperty('pos');
            expect(header.pos).toBe(-1);
        });
    });
});

/**
 * Tests for getTaskColumnPosFromHeaderRow - parses CSV header row to find column positions
 * Updates taskFileColumnHeaders[pos] with found indices
 * Returns reference to same object
 */
describe('getTaskColumnPosFromHeaderRow', () => {
    test('should find column positions from header row', () => {
        const headerRow = ['Task counter', 'Task type', 'Task name', 'Task id', 'Task enabled', 'App name', 'Task status'];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result.taskCounter.pos).toBe(0);
        expect(result.taskType.pos).toBe(1);
        expect(result.taskName.pos).toBe(2);
        expect(result.taskId.pos).toBe(3);
        expect(result.taskEnabled.pos).toBe(4);
        expect(result.appName.pos).toBe(5);
        expect(result.taskStatus.pos).toBe(6);
    });

    test('should return -1 for missing columns', () => {
        const headerRow = ['Task name'];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result.taskName.pos).toBe(0);
        expect(result.taskCounter.pos).toBe(-1);
        expect(result.taskType.pos).toBe(-1);
    });

    test('should handle empty header row', () => {
        const headerRow = [];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result.taskName.pos).toBe(-1);
        expect(result.taskCounter.pos).toBe(-1);
    });

    test('should return the same object reference', () => {
        const headerRow = ['Task name'];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result).toBe(taskFileColumnHeaders);
    });
});

/**
 * Tests for getAppColumnPosFromHeaderRow - parses CSV header row for app import columns
 * Updates appFileColumnHeaders[pos] with found indices
 */
describe('getAppColumnPosFromHeaderRow', () => {
    test('should find column positions from header row', () => {
        const headerRow = ['App counter', 'App name', 'QVF directory', 'QVF name', 'App tags'];
        const result = getAppColumnPosFromHeaderRow(headerRow);

        expect(result.appCounter.pos).toBe(0);
        expect(result.appName.pos).toBe(1);
        expect(result.qvfDirectory.pos).toBe(2);
        expect(result.qvfName.pos).toBe(3);
        expect(result.appTags.pos).toBe(4);
    });

    test('should return -1 for missing columns', () => {
        const headerRow = ['App name'];
        const result = getAppColumnPosFromHeaderRow(headerRow);

        expect(result.appName.pos).toBe(0);
        expect(result.appCounter.pos).toBe(-1);
    });

    test('should handle empty header row', () => {
        const headerRow = [];
        const result = getAppColumnPosFromHeaderRow(headerRow);

        expect(result.appName.pos).toBe(-1);
    });

    test('should return the same object reference', () => {
        const headerRow = ['App name'];
        const result = getAppColumnPosFromHeaderRow(headerRow);

        expect(result).toBe(appFileColumnHeaders);
    });
});

describe('Edge cases', () => {
    test('should handle duplicate headers (finds first)', () => {
        const headerRow = ['Task name', 'Task name', 'Task name'];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result.taskName.pos).toBe(0);
    });

    test('column headers should be case-sensitive', () => {
        const headerRow = ['task name', 'Task name'];
        const result = getTaskColumnPosFromHeaderRow(headerRow);

        expect(result.taskName.pos).toBe(1);
    });

    test('maps should be immutable', () => {
        const initialSize = mapTaskType.size;
        mapTaskType.set(99, 'Test');
        expect(mapTaskType.size).toBe(initialSize + 1);
    });
});

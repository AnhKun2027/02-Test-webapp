'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatPageNumber } = require('./formatPageNumber');

test('returns "current / total" for normal inputs', () => {
  assert.equal(formatPageNumber(1, 10), '1 / 10');
});

test('returns "-" when total is 0', () => {
  assert.equal(formatPageNumber(1, 0), '-');
});

test('returns "-" when total is null', () => {
  assert.equal(formatPageNumber(1, null), '-');
});

test('returns "-" when total is undefined', () => {
  assert.equal(formatPageNumber(1, undefined), '-');
});

test('throws TypeError when current is not a number', () => {
  assert.throws(() => formatPageNumber('a', 10), TypeError);
});

test('throws TypeError when total is not a number (non-null)', () => {
  assert.throws(() => formatPageNumber(1, '10'), TypeError);
});

test('throws TypeError when current is null', () => {
  assert.throws(() => formatPageNumber(null, 10), TypeError);
});

test('throws TypeError when current is undefined', () => {
  assert.throws(() => formatPageNumber(undefined, 10), TypeError);
});

test('throws TypeError when current is not a number even if total is null', () => {
  assert.throws(() => formatPageNumber('page one', null), TypeError);
});

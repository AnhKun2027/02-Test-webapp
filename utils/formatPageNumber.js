/** formatPageNumber — 数ページ表示文字列を生成するユーティリティ */

'use strict';

/**
 * 現在ページと合計ページ数から表示文字列を生成する
 * @param {number} current - 現在のページ番号
 * @param {number|null|undefined} total - 合計ページ数（null/undefined は "なし" 扱い）
 * @returns {string} "current / total" 形式、または total が 0/null/undefined の場合は "-"
 * @throws {TypeError} current または total が number/null/undefined 以外の場合
 */
function formatPageNumber(current, total) {
  if (typeof current !== 'number') {
    throw new TypeError('current and total must be numbers');
  }
  // == null catches both null and undefined (intentional loose check)
  if (total == null) {
    return '-';
  }
  if (typeof total !== 'number') {
    throw new TypeError('current and total must be numbers');
  }
  if (total === 0) {
    return '-';
  }
  return `${current} / ${total}`;
}

module.exports = { formatPageNumber };

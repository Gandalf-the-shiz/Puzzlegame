/**
 * economy.js — Wizard Dust economy
 *
 * Dust is the shared currency earned across all puzzle modes.
 * Rates and bonuses are defined here so they are easy to tune.
 */

'use strict';

const Economy = (() => {

  // ── Dust earn rates ─────────────────────────────────────────────
  const RATES = {
    match:       { perPoint: 0.001, completion: 20, daily: 50 },
    connector:   { perGroup: 15,    completion: 40, daily: 80 },
    wordle:      { perGuess: 5,     completion: 30, daily: 70 },
    miniwordgrid:{ perCell: 2,      completion: 25, daily: 60 },
    minesweeper: { perCell: 1,      completion: 30, daily: 70 },
    watersort:   { perLevel: 20,    completion: 25, daily: 60 },
    mahjong:     { perPair: 2,      completion: 35, daily: 75 },
  };

  function getDust() {
    return Storage.getDust();
  }

  function addDust(amount) {
    const current = getDust();
    const rounded = Math.max(0, Math.round(amount));
    Storage.setDust(current + rounded);
    _notifyListeners(current + rounded);
    return rounded;
  }

  function spendDust(amount) {
    const current = getDust();
    if (current < amount) return false;
    Storage.setDust(current - amount);
    _notifyListeners(current - amount);
    return true;
  }

  // ── Change listeners (for UI updates) ───────────────────────────
  const _listeners = [];
  function _notifyListeners(newVal) {
    _listeners.forEach(fn => { try { fn(newVal); } catch {} });
  }
  function onChange(fn) { _listeners.push(fn); }

  // ── Reward helpers per mode ──────────────────────────────────────

  function rewardMatch(score, isDaily, dailyCompleted) {
    const r = RATES.match;
    let dust = Math.floor(score * r.perPoint) + r.completion;
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardConnector(groupsFound, isDaily, dailyCompleted) {
    const r = RATES.connector;
    let dust = groupsFound * r.perGroup + r.completion;
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardWordle(guessesUsed, won, isDaily, dailyCompleted) {
    const r = RATES.wordle;
    let dust = won ? (7 - guessesUsed) * r.perGuess + r.completion : 5;
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardMiniWordGrid(cellsFilled, isDaily, dailyCompleted) {
    const r = RATES.miniwordgrid;
    let dust = cellsFilled * r.perCell + r.completion;
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardMinesweeper(cellsRevealed, won, isDaily, dailyCompleted) {
    const r = RATES.minesweeper;
    let dust = cellsRevealed * r.perCell + (won ? r.completion : 5);
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardWaterSort(levelNum, isDaily, dailyCompleted) {
    const r = RATES.watersort;
    let dust = levelNum * r.perLevel + r.completion;
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  function rewardMahjong(pairsRemoved, won, isDaily, dailyCompleted) {
    const r = RATES.mahjong;
    let dust = pairsRemoved * r.perPair + (won ? r.completion : 5);
    if (isDaily && dailyCompleted) dust += r.daily;
    return addDust(dust);
  }

  return {
    getDust,
    addDust,
    spendDust,
    onChange,
    rewardMatch,
    rewardConnector,
    rewardWordle,
    rewardMiniWordGrid,
    rewardMinesweeper,
    rewardWaterSort,
    rewardMahjong,
  };
})();

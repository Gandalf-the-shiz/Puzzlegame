/**
 * block.js — Block class defining types and behavior
 */

'use strict';

class Block {
  /**
   * @param {string} type  — One of BlockType values
   * @param {string|null} color — One of COLORS entries (null for rainbow/number)
   * @param {number} value — Numeric value (for NUMBER type)
   */
  constructor(type = BlockType.NORMAL, color = null, value = 0) {
    this.type  = type;
    this.color = color;
    this.value = value; // for NUMBER type: 2, 4, 8, …

    // Unique ID for tracking during animations
    this.id = Block._nextId++;

    // Animation state — managed by Renderer
    this.anim = {
      alpha:   1,
      scaleX:  1,
      scaleY:  1,
      offsetX: 0,  // pixel offset from logical grid position
      offsetY: 0,
      shaking: false,
    };

    // Marks this block for removal after match animation
    this.matched   = false;
    this.selected  = false;
    this.justSpawned = false;
  }

  /**
   * Returns true if this block can match with another block
   */
  matches(other) {
    if (!other) return false;
    if (this.type === BlockType.BLOCKER || other.type === BlockType.BLOCKER) return false;

    // Rainbow matches anything non-blocker
    if (this.type === BlockType.RAINBOW || other.type === BlockType.RAINBOW) return true;

    // BOMB blocks match same-type bombs only (they chain)
    if (this.type === BlockType.BOMB && other.type === BlockType.BOMB) return true;

    // NUMBER blocks match same value
    if (this.type === BlockType.NUMBER && other.type === BlockType.NUMBER) {
      return this.value === other.value;
    }

    // NORMAL blocks match same color
    if (this.type === BlockType.NORMAL && other.type === BlockType.NORMAL) {
      return this.color === other.color;
    }

    return false;
  }

  /**
   * Can this block be moved/swapped by the player?
   */
  canMove() {
    return this.type !== BlockType.BLOCKER;
  }

  /**
   * What does this block look like for matching purposes?
   * Returns a string key used to group blocks.
   */
  matchKey() {
    if (this.type === BlockType.RAINBOW) return '__rainbow__';
    if (this.type === BlockType.BLOCKER) return '__blocker__';
    if (this.type === BlockType.BOMB)    return '__bomb__';
    if (this.type === BlockType.NUMBER)  return `num_${this.value}`;
    return `color_${this.color}`;
  }

  /**
   * Create a deep clone of this block (without animation state)
   */
  clone() {
    return new Block(this.type, this.color, this.value);
  }

  /**
   * Static factory — create a random NORMAL block using a color pool
   */
  static randomNormal(colorPool) {
    return new Block(BlockType.NORMAL, randomPick(colorPool), 0);
  }

  /**
   * Static factory — create a NUMBER block with the given value
   */
  static number(value) {
    return new Block(BlockType.NUMBER, null, value);
  }

  /**
   * Static factory — create a BLOCKER block
   */
  static blocker() {
    return new Block(BlockType.BLOCKER, BLOCKER_COLOR, 0);
  }

  /**
   * Static factory — create a BOMB block
   */
  static bomb() {
    return new Block(BlockType.BOMB, BOMB_COLOR, 0);
  }

  /**
   * Static factory — create a RAINBOW block
   */
  static rainbow() {
    return new Block(BlockType.RAINBOW, null, 0);
  }
}

Block._nextId = 1;

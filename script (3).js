/**
 * Modern Professional Calculator
 * Safe expression parser, scientific functions, history, memory, and audio synthesizer.
 */

// ==========================================
// 1. Audio Synthesizer (Web Audio API)
// ==========================================
class SoundFeedback {
  constructor() {
    this.audioCtx = null;
    this.enabled = localStorage.getItem('calc_sound_enabled') !== 'false';
  }

  init() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('calc_sound_enabled', this.enabled);
    return this.enabled;
  }

  playClick(type = 'normal') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      let freq = 600;
      let duration = 0.025;
      let typeWave = 'sine';

      if (type === 'operator') {
        freq = 800;
        duration = 0.035;
      } else if (type === 'equals') {
        freq = 1040;
        duration = 0.05;
        typeWave = 'triangle';
      } else if (type === 'clear') {
        freq = 420;
        duration = 0.04;
      } else if (type === 'error') {
        freq = 240;
        duration = 0.08;
        typeWave = 'sawtooth';
      }

      osc.type = typeWave;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay or permissions prevented
    }
  }
}

// ==========================================
// 2. Safe Math Evaluator (No eval())
// ==========================================
class MathEvaluator {
  constructor() {
    this.angleMode = 'DEG'; // 'DEG' or 'RAD'
  }

  setAngleMode(mode) {
    this.angleMode = mode;
  }

  factorial(n) {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('Invalid factorial');
    }
    if (n > 170) {
      throw new Error('Number too large');
    }
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  sin(val) {
    if (this.angleMode === 'DEG') {
      const normalized = ((val % 360) + 360) % 360;
      if (normalized === 0 || normalized === 180 || normalized === 360) return 0;
      if (normalized === 90) return 1;
      if (normalized === 270) return -1;
      return Math.sin(this.toRadians(val));
    }
    return Math.sin(val);
  }

  cos(val) {
    if (this.angleMode === 'DEG') {
      const normalized = ((val % 360) + 360) % 360;
      if (normalized === 90 || normalized === 270) return 0;
      if (normalized === 0 || normalized === 360) return 1;
      if (normalized === 180) return -1;
      return Math.cos(this.toRadians(val));
    }
    return Math.cos(val);
  }

  tan(val) {
    if (this.angleMode === 'DEG') {
      const normalized = ((val % 180) + 180) % 180;
      if (normalized === 90) {
        throw new Error('Undefined');
      }
      if (normalized === 0) return 0;
      if (normalized === 45) return 1;
      if (normalized === 135) return -1;
      return Math.tan(this.toRadians(val));
    }
    const cosVal = Math.cos(val);
    if (Math.abs(cosVal) < 1e-15) {
      throw new Error('Undefined');
    }
    return Math.tan(val);
  }

  // Tokenize the raw mathematical formula
  tokenize(rawExpr) {
    // Replace visual symbols
    let expr = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√\(/g, 'sqrt(')
      .replace(/√([0-9.]+)/g, 'sqrt($1)');

    const tokens = [];
    let i = 0;
    const len = expr.length;

    while (i < len) {
      const ch = expr[i];

      // Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Numbers (including decimal point)
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] || ''))) {
        let numStr = '';
        let hasDot = false;
        while (i < len && (/[0-9]/.test(expr[i]) || (expr[i] === '.' && !hasDot))) {
          if (expr[i] === '.') hasDot = true;
          numStr += expr[i];
          i++;
        }
        tokens.push({ type: 'number', value: parseFloat(numStr) });
        continue;
      }

      // Identifiers / words / functions / constants
      if (/[a-zA-Z]/.test(ch)) {
        let idStr = '';
        while (i < len && /[a-zA-Z0-9]/.test(expr[i])) {
          idStr += expr[i];
          i++;
        }
        idStr = idStr.toLowerCase();

        if (idStr === 'pi') {
          tokens.push({ type: 'number', value: Math.PI });
        } else if (idStr === 'e') {
          tokens.push({ type: 'number', value: Math.E });
        } else if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'cbrt', 'abs'].includes(idStr)) {
          tokens.push({ type: 'function', value: idStr });
        } else {
          throw new Error(`Unknown function: ${idStr}`);
        }
        continue;
      }

      // Factorial postfix operator
      if (ch === '!') {
        tokens.push({ type: 'factorial', value: '!' });
        i++;
        continue;
      }

      // Single character operators & parentheses
      if (['+', '-', '*', '/', '%', '^', '(', ')'].includes(ch)) {
        // Detect unary minus
        if (ch === '-') {
          const prevToken = tokens[tokens.length - 1];
          if (!prevToken || prevToken.type === 'operator' || prevToken.type === 'function' || (prevToken.type === 'parenthesis' && prevToken.value === '(')) {
            tokens.push({ type: 'unaryMinus', value: 'u-' });
            i++;
            continue;
          }
        }
        if (ch === '+' && (!tokens.length || tokens[tokens.length - 1].type === 'operator' || (tokens[tokens.length - 1].type === 'parenthesis' && tokens[tokens.length - 1].value === '('))) {
          // Unary plus, ignore
          i++;
          continue;
        }

        if (ch === '(' || ch === ')') {
          tokens.push({ type: 'parenthesis', value: ch });
        } else {
          tokens.push({ type: 'operator', value: ch });
        }
        i++;
        continue;
      }

      throw new Error(`Unexpected character: ${ch}`);
    }

    // Insert implicit multiplications: e.g. 2(3), (2)(3), 2pi, 2sin(30), etc.
    const refinedTokens = [];
    for (let j = 0; j < tokens.length; j++) {
      const current = tokens[j];
      const prev = refinedTokens[refinedTokens.length - 1];

      if (prev) {
        const prevIsValue = prev.type === 'number' || prev.type === 'factorial' || (prev.type === 'parenthesis' && prev.value === ')');
        const currIsValueOrFunc = current.type === 'number' || current.type === 'function' || (current.type === 'parenthesis' && current.value === '(');

        if (prevIsValue && currIsValueOrFunc) {
          refinedTokens.push({ type: 'operator', value: '*' });
        }
      }
      refinedTokens.push(current);
    }

    return refinedTokens;
  }

  // Shunting-Yard Algorithm to convert tokens to Reverse Polish Notation (RPN)
  toRPN(tokens) {
    const outputQueue = [];
    const opStack = [];

    const precedence = {
      '+': 2,
      '-': 2,
      '*': 3,
      '/': 3,
      '%': 3,
      '^': 4,
      'u-': 5,
    };

    const isRightAssociative = {
      '^': true,
      'u-': true,
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'number') {
        outputQueue.push(token);
      } else if (token.type === 'function') {
        opStack.push(token);
      } else if (token.type === 'factorial') {
        outputQueue.push(token);
      } else if (token.type === 'operator' || token.type === 'unaryMinus') {
        const o1 = token.value;
        while (opStack.length > 0) {
          const top = opStack[opStack.length - 1];
          if (top.type === 'operator' || top.type === 'unaryMinus') {
            const o2 = top.value;
            const p1 = precedence[o1];
            const p2 = precedence[o2];
            if ((!isRightAssociative[o1] && p1 <= p2) || (isRightAssociative[o1] && p1 < p2)) {
              outputQueue.push(opStack.pop());
              continue;
            }
          }
          break;
        }
        opStack.push(token);
      } else if (token.type === 'parenthesis' && token.value === '(') {
        opStack.push(token);
      } else if (token.type === 'parenthesis' && token.value === ')') {
        let matched = false;
        while (opStack.length > 0) {
          const top = opStack.pop();
          if (top.type === 'parenthesis' && top.value === '(') {
            matched = true;
            break;
          }
          outputQueue.push(top);
        }
        if (!matched) {
          throw new Error('Mismatched parentheses');
        }
        // If the token at the top of the stack is a function, pop it onto output queue
        if (opStack.length > 0 && opStack[opStack.length - 1].type === 'function') {
          outputQueue.push(opStack.pop());
        }
      }
    }

    while (opStack.length > 0) {
      const top = opStack.pop();
      if (top.type === 'parenthesis') {
        throw new Error('Mismatched parentheses');
      }
      outputQueue.push(top);
    }

    return outputQueue;
  }

  // Evaluate RPN Queue
  evaluateRPN(rpnQueue) {
    const stack = [];

    for (let i = 0; i < rpnQueue.length; i++) {
      const token = rpnQueue[i];

      if (token.type === 'number') {
        stack.push(token.value);
      } else if (token.type === 'unaryMinus') {
        if (stack.length < 1) throw new Error('Invalid expression');
        const val = stack.pop();
        stack.push(-val);
      } else if (token.type === 'factorial') {
        if (stack.length < 1) throw new Error('Invalid expression');
        const val = stack.pop();
        stack.push(this.factorial(val));
      } else if (token.type === 'function') {
        if (stack.length < 1) throw new Error('Invalid expression');
        const arg = stack.pop();
        let res;
        switch (token.value) {
          case 'sin':
            res = this.sin(arg);
            break;
          case 'cos':
            res = this.cos(arg);
            break;
          case 'tan':
            res = this.tan(arg);
            break;
          case 'log':
            if (arg <= 0) throw new Error('Invalid logarithm');
            res = Math.log10(arg);
            break;
          case 'ln':
            if (arg <= 0) throw new Error('Invalid logarithm');
            res = Math.log(arg);
            break;
          case 'sqrt':
            if (arg < 0) throw new Error('Invalid square root');
            res = Math.sqrt(arg);
            break;
          case 'cbrt':
            res = Math.cbrt(arg);
            break;
          case 'abs':
            res = Math.abs(arg);
            break;
          default:
            throw new Error(`Unknown function: ${token.value}`);
        }
        stack.push(res);
      } else if (token.type === 'operator') {
        if (stack.length < 2) throw new Error('Invalid expression');
        const b = stack.pop();
        const a = stack.pop();
        let res;

        switch (token.value) {
          case '+':
            res = a + b;
            break;
          case '-':
            res = a - b;
            break;
          case '*':
            res = a * b;
            break;
          case '/':
            if (Math.abs(b) === 0) {
              throw new Error('Cannot divide by zero');
            }
            res = a / b;
            break;
          case '%':
            if (Math.abs(b) === 0) {
              throw new Error('Cannot divide by zero');
            }
            res = a % b;
            break;
          case '^':
            if (a < 0 && !Number.isInteger(b)) {
              throw new Error('Invalid power');
            }
            res = Math.pow(a, b);
            break;
          default:
            throw new Error(`Unknown operator: ${token.value}`);
        }
        stack.push(res);
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid expression');
    }

    const finalVal = stack[0];
    if (isNaN(finalVal) || !isFinite(finalVal)) {
      throw new Error('Cannot divide by zero');
    }

    return this.cleanFloat(finalVal);
  }

  cleanFloat(val) {
    // Handle floating-point imprecision: e.g. 0.1 + 0.2 = 0.30000000000000004 -> 0.3
    const rounded = parseFloat(Number(val).toPrecision(12));
    if (Math.abs(rounded) < 1e-14) return 0;
    return rounded;
  }

  evaluate(expression) {
    if (!expression || !expression.trim()) {
      return 0;
    }
    const tokens = this.tokenize(expression.trim());
    if (tokens.length === 0) return 0;
    const rpn = this.toRPN(tokens);
    return this.evaluateRPN(rpn);
  }
}

// ==========================================
// 3. Calculator Controller & UI State
// ==========================================
class CalculatorApp {
  constructor() {
    this.evaluator = new MathEvaluator();
    this.sound = new SoundFeedback();

    // Calculator State
    this.expression = '';
    this.result = '0';
    this.lastCalculation = '';
    this.isEvaluated = false;
    this.memory = parseFloat(localStorage.getItem('calc_memory') || '0');
    this.history = JSON.parse(localStorage.getItem('calc_history') || '[]');
    this.angleMode = localStorage.getItem('calc_angle_mode') || 'DEG';
    this.isScientific = localStorage.getItem('calc_is_scientific') === 'true';

    this.evaluator.setAngleMode(this.angleMode);

    this.initDOM();
    this.bindEvents();
    this.applyTheme(localStorage.getItem('calc_theme') || 'dark');
    this.updateDisplay();
    this.renderHistory();
    this.updateMemoryBadge();
    this.updateSoundIcon();
    this.updateScientificModeUI();
    this.updateAngleModeUI();
  }

  initDOM() {
    // Displays
    this.exprDisplay = document.getElementById('calc-expression');
    this.resultDisplay = document.getElementById('calc-result');
    this.prevCalcDisplay = document.getElementById('calc-prev');
    this.errorBanner = document.getElementById('calc-error-banner');
    this.memoryBadge = document.getElementById('memory-badge');
    this.angleBadge = document.getElementById('angle-badge');
    this.historyBadge = document.getElementById('history-count-badge');
    this.historyCount = document.getElementById('history-count-text');

    // Panels & Modals
    this.historyPanel = document.getElementById('history-panel');
    this.historyBackdrop = document.getElementById('history-backdrop');
    this.historyList = document.getElementById('history-list');
    this.shortcutsModal = document.getElementById('shortcuts-modal');
    this.shortcutsBackdrop = document.getElementById('shortcuts-backdrop');
    this.toast = document.getElementById('toast');

    // Controls
    this.themeToggleBtn = document.getElementById('btn-theme-toggle');
    this.soundToggleBtn = document.getElementById('btn-sound-toggle');
    this.historyToggleBtn = document.getElementById('btn-history-toggle');
    this.modeToggleBtn = document.getElementById('btn-mode-toggle');
    this.fullscreenToggleBtn = document.getElementById('btn-fullscreen-toggle');
    this.helpToggleBtn = document.getElementById('btn-help-toggle');
    this.scientificContainer = document.getElementById('scientific-keys');
    this.calculatorContainer = document.getElementById('calculator-app');
  }

  bindEvents() {
    // Button clicks on keypad
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const val = btn.dataset.value;
        this.handleAction(action, val);
        this.triggerButtonRipple(btn);
      });
    });

    // Theme toggle
    this.themeToggleBtn?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      this.sound.playClick('normal');
    });

    // Sound toggle
    this.soundToggleBtn?.addEventListener('click', () => {
      const enabled = this.sound.toggle();
      this.updateSoundIcon();
      this.showToast(enabled ? 'Sound feedback ON' : 'Sound feedback OFF');
      if (enabled) this.sound.playClick('normal');
    });

    // Mode toggle (Basic vs Scientific)
    this.modeToggleBtn?.addEventListener('click', () => {
      this.isScientific = !this.isScientific;
      localStorage.setItem('calc_is_scientific', this.isScientific);
      this.updateScientificModeUI();
      this.sound.playClick('normal');
    });

    // History drawer toggle
    this.historyToggleBtn?.addEventListener('click', () => {
      this.toggleHistoryPanel(true);
      this.sound.playClick('normal');
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
      this.toggleHistoryPanel(false);
      this.sound.playClick('normal');
    });

    this.historyBackdrop?.addEventListener('click', () => {
      this.toggleHistoryPanel(false);
    });

    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      this.clearAllHistory();
      this.sound.playClick('clear');
    });

    // Fullscreen toggle
    this.fullscreenToggleBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
      this.sound.playClick('normal');
    });

    // Shortcuts modal
    this.helpToggleBtn?.addEventListener('click', () => {
      this.toggleShortcutsModal(true);
      this.sound.playClick('normal');
    });

    document.getElementById('btn-close-shortcuts')?.addEventListener('click', () => {
      this.toggleShortcutsModal(false);
      this.sound.playClick('normal');
    });

    this.shortcutsBackdrop?.addEventListener('click', () => {
      this.toggleShortcutsModal(false);
    });

    // Copy buttons
    document.getElementById('btn-copy-result')?.addEventListener('click', () => {
      this.copyToClipboard(this.result, 'Result copied to clipboard!');
      this.sound.playClick('normal');
    });

    document.getElementById('btn-copy-expr')?.addEventListener('click', () => {
      this.copyToClipboard(this.expression || this.result, 'Expression copied to clipboard!');
      this.sound.playClick('normal');
    });

    // Global keyboard listener
    window.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  triggerButtonRipple(btn) {
    btn.classList.remove('btn-active-pulse');
    void btn.offsetWidth; // Trigger reflow
    btn.classList.add('btn-active-pulse');
  }

  handleAction(action, val) {
    this.hideError();

    switch (action) {
      case 'number':
        this.appendNumber(val);
        this.sound.playClick('normal');
        break;
      case 'decimal':
        this.appendDecimal();
        this.sound.playClick('normal');
        break;
      case 'operator':
        this.appendOperator(val);
        this.sound.playClick('operator');
        break;
      case 'equals':
        this.calculate();
        break;
      case 'clear':
        this.clearAll();
        this.sound.playClick('clear');
        break;
      case 'delete':
        this.deleteLast();
        this.sound.playClick('normal');
        break;
      case 'sign':
        this.toggleSign();
        this.sound.playClick('normal');
        break;
      case 'percent':
        this.applyPercent();
        this.sound.playClick('operator');
        break;
      case 'paren-open':
        this.appendParenthesis('(');
        this.sound.playClick('normal');
        break;
      case 'paren-close':
        this.appendParenthesis(')');
        this.sound.playClick('normal');
        break;
      case 'constant':
        this.appendConstant(val);
        this.sound.playClick('normal');
        break;
      case 'function':
        this.appendFunction(val);
        this.sound.playClick('operator');
        break;
      case 'special-power':
        this.appendSpecialPower(val);
        this.sound.playClick('operator');
        break;
      case 'reciprocal':
        this.applyReciprocal();
        this.sound.playClick('operator');
        break;
      case 'factorial':
        this.appendFactorial();
        this.sound.playClick('operator');
        break;
      case 'angle-toggle':
        this.toggleAngleMode();
        this.sound.playClick('normal');
        break;
      // Memory operations
      case 'mc':
        this.memoryClear();
        this.sound.playClick('clear');
        break;
      case 'mr':
        this.memoryRecall();
        this.sound.playClick('normal');
        break;
      case 'm-plus':
        this.memoryAdd();
        this.sound.playClick('normal');
        break;
      case 'm-minus':
        this.memorySubtract();
        this.sound.playClick('normal');
        break;
      default:
        break;
    }

    this.updateDisplay();
  }

  appendNumber(digit) {
    if (this.isEvaluated) {
      this.expression = '';
      this.isEvaluated = false;
    }
    // Prevent leading zeroes duplication e.g. "00"
    if (this.expression === '0' && digit !== '.') {
      this.expression = digit;
    } else {
      this.expression += digit;
    }
    this.livePreview();
  }

  appendDecimal() {
    if (this.isEvaluated) {
      this.expression = '0';
      this.isEvaluated = false;
    }

    // Find the last number token in the expression
    const tokens = this.expression.split(/[\+\−\×\÷\%\^\(\)]/);
    const lastToken = tokens[tokens.length - 1];

    if (!lastToken.includes('.')) {
      if (!lastToken || lastToken === '') {
        this.expression += '0.';
      } else {
        this.expression += '.';
      }
    }
    this.livePreview();
  }

  appendOperator(op) {
    if (this.isEvaluated) {
      // Continue from the previous result
      this.expression = String(this.result);
      this.isEvaluated = false;
    }

    if (!this.expression && op === '−') {
      // Unary minus at start
      this.expression = '−';
      return;
    }

    if (!this.expression) {
      this.expression = '0' + op;
      return;
    }

    const lastChar = this.expression.slice(-1);
    const ops = ['+', '−', '×', '÷', '%', '^'];

    if (ops.includes(lastChar)) {
      // Replace last operator
      this.expression = this.expression.slice(0, -1) + op;
    } else {
      this.expression += op;
    }
  }

  appendParenthesis(paren) {
    if (this.isEvaluated) {
      if (paren === '(') {
        this.expression = '(';
      } else {
        this.expression = String(this.result) + ')';
      }
      this.isEvaluated = false;
    } else {
      this.expression += paren;
    }
    this.livePreview();
  }

  appendConstant(constName) {
    const symbol = constName === 'pi' ? 'π' : 'e';
    if (this.isEvaluated) {
      this.expression = symbol;
      this.isEvaluated = false;
    } else {
      // Check if preceding is a number or closing paren, insert implicit ×
      const lastChar = this.expression.slice(-1);
      if (lastChar && (/[0-9\)]/.test(lastChar) || lastChar === 'π' || lastChar === 'e')) {
        this.expression += '×' + symbol;
      } else {
        this.expression += symbol;
      }
    }
    this.livePreview();
  }

  appendFunction(funcName) {
    const fnMap = {
      sin: 'sin(',
      cos: 'cos(',
      tan: 'tan(',
      log: 'log(',
      ln: 'ln(',
      sqrt: '√(',
      cbrt: 'cbrt(',
    };

    const funcToken = fnMap[funcName] || `${funcName}(`;

    if (this.isEvaluated) {
      // Wrap previous result into function: e.g. sin(ans)
      this.expression = `${funcToken}${this.result})`;
      this.isEvaluated = false;
    } else {
      const lastChar = this.expression.slice(-1);
      if (lastChar && (/[0-9\)]/.test(lastChar) || lastChar === 'π' || lastChar === 'e')) {
        this.expression += '×' + funcToken;
      } else {
        this.expression += funcToken;
      }
    }
    this.livePreview();
  }

  appendSpecialPower(powerType) {
    if (powerType === 'sqr') {
      // x² -> ^2
      if (this.isEvaluated) {
        this.expression = `(${this.result})^2`;
        this.isEvaluated = false;
      } else if (this.expression) {
        this.expression += '^2';
      }
    } else if (powerType === 'cube') {
      // x³ -> ^3
      if (this.isEvaluated) {
        this.expression = `(${this.result})^3`;
        this.isEvaluated = false;
      } else if (this.expression) {
        this.expression += '^3';
      }
    } else if (powerType === 'power') {
      // xʸ -> ^
      this.appendOperator('^');
    }
    this.livePreview();
  }

  applyReciprocal() {
    if (this.isEvaluated || !this.expression) {
      const val = parseFloat(this.result);
      if (val === 0) {
        this.showError('Cannot divide by zero');
        return;
      }
      this.expression = `1/(${this.result})`;
      this.isEvaluated = false;
    } else {
      this.expression = `1/(${this.expression})`;
    }
    this.livePreview();
  }

  appendFactorial() {
    if (this.isEvaluated) {
      this.expression = `(${this.result})!`;
      this.isEvaluated = false;
    } else if (this.expression) {
      this.expression += '!';
    }
    this.livePreview();
  }

  toggleSign() {
    if (this.isEvaluated || !this.expression) {
      const num = parseFloat(this.result);
      if (!isNaN(num)) {
        this.result = String(-num);
        this.expression = this.result;
      }
      return;
    }

    // Attempt to toggle the sign of the last number or parenthesized term
    const match = this.expression.match(/([−\+]?)([0-9.]+)$/);
    if (match) {
      const [full, sign, num] = match;
      const index = match.index;
      let newSign = sign === '−' ? '+' : '−';
      if (index === 0 && newSign === '+') newSign = ''; // Leading positive
      this.expression = this.expression.slice(0, index) + newSign + num;
    } else {
      this.expression = `−(${this.expression})`;
    }
    this.livePreview();
  }

  applyPercent() {
    if (this.isEvaluated || !this.expression) {
      const val = parseFloat(this.result);
      this.result = String(val / 100);
      this.expression = this.result;
    } else {
      this.expression += '%';
    }
    this.livePreview();
  }

  deleteLast() {
    if (this.isEvaluated) {
      this.expression = '';
      this.isEvaluated = false;
      this.updateDisplay();
      return;
    }

    if (this.expression.length > 0) {
      // Check if ending with multi-char function token like "sin(", "cos(", "log(", "cbrt(", "√("
      const funcMatches = ['cbrt(', 'sqrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', '√('];
      let removed = false;
      for (const fn of funcMatches) {
        if (this.expression.endsWith(fn)) {
          this.expression = this.expression.slice(0, -fn.length);
          removed = true;
          break;
        }
      }

      if (!removed) {
        this.expression = this.expression.slice(0, -1);
      }
      this.livePreview();
    }
  }

  clearAll() {
    this.expression = '';
    this.result = '0';
    this.isEvaluated = false;
    this.hideError();
  }

  livePreview() {
    if (!this.expression.trim()) {
      this.result = '0';
      return;
    }

    try {
      // Only evaluate if it ends with a valid evaluatable token
      const lastChar = this.expression.slice(-1);
      if (/[0-9\)\!πe]/.test(lastChar)) {
        const preview = this.evaluator.evaluate(this.expression);
        this.result = String(preview);
      }
    } catch (e) {
      // Ignore intermediate syntax errors during typing
    }
  }

  calculate() {
    if (!this.expression.trim()) return;

    try {
      const calculated = this.evaluator.evaluate(this.expression);
      const cleanResult = String(calculated);

      this.sound.playClick('equals');

      // Save to history
      this.addHistory(this.expression, cleanResult);

      this.lastCalculation = `${this.expression} =`;
      this.result = cleanResult;
      this.expression = cleanResult;
      this.isEvaluated = true;
      this.hideError();
    } catch (err) {
      this.sound.playClick('error');
      this.showError(err.message || 'Invalid expression');
    }

    this.updateDisplay();
  }

  showError(msg) {
    if (this.errorBanner) {
      this.errorBanner.textContent = msg;
      this.errorBanner.classList.add('visible');
    }
  }

  hideError() {
    if (this.errorBanner) {
      this.errorBanner.classList.remove('visible');
    }
  }

  updateDisplay() {
    if (this.exprDisplay) {
      this.exprDisplay.textContent = this.expression || ' ';
      this.adjustTextSize(this.exprDisplay, 22, 14);
      // Auto-scroll to the end of expression
      this.exprDisplay.scrollLeft = this.exprDisplay.scrollWidth;
    }

    if (this.resultDisplay) {
      this.resultDisplay.textContent = this.result;
      this.adjustTextSize(this.resultDisplay, 44, 18);
    }

    if (this.prevCalcDisplay) {
      this.prevCalcDisplay.textContent = this.lastCalculation;
    }
  }

  adjustTextSize(el, maxPx, minPx) {
    if (!el) return;
    const len = (el.textContent || '').length;
    let size = maxPx;

    if (len > 12) {
      size = Math.max(minPx, maxPx - (len - 12) * 1.5);
    }
    el.style.fontSize = `${size}px`;
  }

  // ==========================================
  // Memory Operations
  // ==========================================
  memoryClear() {
    this.memory = 0;
    localStorage.setItem('calc_memory', '0');
    this.updateMemoryBadge();
    this.showToast('Memory Cleared (MC)');
  }

  memoryRecall() {
    this.result = String(this.memory);
    if (this.isEvaluated || !this.expression) {
      this.expression = String(this.memory);
      this.isEvaluated = false;
    } else {
      this.expression += String(this.memory);
    }
    this.showToast(`Memory Recalled: ${this.memory}`);
  }

  memoryAdd() {
    const val = parseFloat(this.result) || 0;
    this.memory += val;
    this.memory = this.evaluator.cleanFloat(this.memory);
    localStorage.setItem('calc_memory', String(this.memory));
    this.updateMemoryBadge();
    this.showToast(`M+ added (${this.memory})`);
  }

  memorySubtract() {
    const val = parseFloat(this.result) || 0;
    this.memory -= val;
    this.memory = this.evaluator.cleanFloat(this.memory);
    localStorage.setItem('calc_memory', String(this.memory));
    this.updateMemoryBadge();
    this.showToast(`M- subtracted (${this.memory})`);
  }

  updateMemoryBadge() {
    if (this.memoryBadge) {
      if (this.memory !== 0) {
        this.memoryBadge.classList.remove('hidden');
        this.memoryBadge.textContent = `M (${this.memory})`;
      } else {
        this.memoryBadge.classList.add('hidden');
      }
    }
  }

  // ==========================================
  // Angle Mode (DEG / RAD)
  // ==========================================
  toggleAngleMode() {
    this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
    localStorage.setItem('calc_angle_mode', this.angleMode);
    this.evaluator.setAngleMode(this.angleMode);
    this.updateAngleModeUI();
    this.showToast(`Angle Mode: ${this.angleMode}`);
    this.livePreview();
  }

  updateAngleModeUI() {
    if (this.angleBadge) {
      this.angleBadge.textContent = this.angleMode;
    }
    const angleBtn = document.getElementById('btn-angle-toggle');
    if (angleBtn) {
      angleBtn.textContent = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
    }
  }

  // ==========================================
  // Scientific Mode UI
  // ==========================================
  updateScientificModeUI() {
    if (this.scientificContainer) {
      if (this.isScientific) {
        this.scientificContainer.classList.remove('hidden-keys');
        this.modeToggleBtn?.classList.add('active-mode');
      } else {
        this.scientificContainer.classList.add('hidden-keys');
        this.modeToggleBtn?.classList.remove('active-mode');
      }
    }
  }

  // ==========================================
  // History Management
  // ==========================================
  addHistory(expr, res) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const item = {
      id: Date.now().toString(),
      expression: expr,
      result: res,
      time: timeString,
      timestamp: now.toISOString(),
    };

    this.history.unshift(item);
    if (this.history.length > 50) {
      this.history.pop();
    }

    localStorage.setItem('calc_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (this.historyBadge) {
      this.historyBadge.textContent = this.history.length;
      if (this.history.length > 0) {
        this.historyBadge.classList.remove('hidden');
      } else {
        this.historyBadge.classList.add('hidden');
      }
    }

    if (this.historyCount) {
      this.historyCount.textContent = `${this.history.length} calculation${this.history.length === 1 ? '' : 's'}`;
    }

    if (!this.historyList) return;

    if (this.history.length === 0) {
      this.historyList.innerHTML = `
        <div class="empty-history-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p class="empty-title">No calculations yet</p>
          <p class="empty-desc">Your calculation history will automatically appear here.</p>
        </div>
      `;
      return;
    }

    this.historyList.innerHTML = this.history
      .map(
        (item) => `
        <div class="history-item" data-id="${item.id}" id="history-item-${item.id}">
          <div class="history-main" data-use-result="${item.result}">
            <div class="history-expr">${this.escapeHTML(item.expression)} =</div>
            <div class="history-res">${this.escapeHTML(item.result)}</div>
            <div class="history-time">${item.time}</div>
          </div>
          <div class="history-item-actions">
            <button class="btn-history-item-action btn-use-res" title="Insert result" data-use-result="${item.result}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>
            <button class="btn-history-item-action btn-del-item" title="Delete entry" data-del-id="${item.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `
      )
      .join('');

    // Bind event listeners for dynamic history items
    this.historyList.querySelectorAll('[data-use-result]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const resVal = el.getAttribute('data-use-result');
        this.useHistoryResult(resVal);
      });
    });

    this.historyList.querySelectorAll('[data-del-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-id');
        this.deleteHistoryItem(id);
      });
    });
  }

  useHistoryResult(val) {
    if (this.isEvaluated || !this.expression) {
      this.expression = val;
      this.isEvaluated = false;
    } else {
      const lastChar = this.expression.slice(-1);
      if (/[0-9\)]/.test(lastChar)) {
        this.expression += '×' + val;
      } else {
        this.expression += val;
      }
    }
    this.livePreview();
    this.updateDisplay();
    this.toggleHistoryPanel(false);
    this.showToast(`Inserted ${val}`);
    this.sound.playClick('normal');
  }

  deleteHistoryItem(id) {
    this.history = this.history.filter((item) => item.id !== id);
    localStorage.setItem('calc_history', JSON.stringify(this.history));
    this.renderHistory();
    this.sound.playClick('clear');
  }

  clearAllHistory() {
    if (this.history.length === 0) return;
    this.history = [];
    localStorage.removeItem('calc_history');
    this.renderHistory();
    this.showToast('Calculation history cleared');
  }

  toggleHistoryPanel(open) {
    if (this.historyPanel && this.historyBackdrop) {
      if (open) {
        this.historyPanel.classList.add('panel-open');
        this.historyBackdrop.classList.add('backdrop-open');
      } else {
        this.historyPanel.classList.remove('panel-open');
        this.historyBackdrop.classList.remove('backdrop-open');
      }
    }
  }

  toggleShortcutsModal(open) {
    if (this.shortcutsModal && this.shortcutsBackdrop) {
      if (open) {
        this.shortcutsModal.classList.add('modal-open');
        this.shortcutsBackdrop.classList.add('backdrop-open');
      } else {
        this.shortcutsModal.classList.remove('modal-open');
        this.shortcutsBackdrop.classList.remove('backdrop-open');
      }
    }
  }

  // ==========================================
  // Keyboard Support
  // ==========================================
  handleKeyboard(e) {
    // If modal or dialog input is focused, let it work normally
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const key = e.key;

    // Trigger visual button highlight if corresponding key exists
    this.highlightKey(key);

    if (/[0-9]/.test(key)) {
      e.preventDefault();
      this.handleAction('number', key);
    } else if (key === '.') {
      e.preventDefault();
      this.handleAction('decimal', '.');
    } else if (key === '+') {
      e.preventDefault();
      this.handleAction('operator', '+');
    } else if (key === '-') {
      e.preventDefault();
      this.handleAction('operator', '−');
    } else if (key === '*') {
      e.preventDefault();
      this.handleAction('operator', '×');
    } else if (key === '/') {
      e.preventDefault();
      this.handleAction('operator', '÷');
    } else if (key === '%') {
      e.preventDefault();
      this.handleAction('percent', '%');
    } else if (key === '^') {
      e.preventDefault();
      this.handleAction('operator', '^');
    } else if (key === '(') {
      e.preventDefault();
      this.handleAction('paren-open', '(');
    } else if (key === ')') {
      e.preventDefault();
      this.handleAction('paren-close', ')');
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      this.handleAction('equals');
    } else if (key === 'Backspace') {
      e.preventDefault();
      this.handleAction('delete');
    } else if (key === 'Escape') {
      e.preventDefault();
      this.toggleHistoryPanel(false);
      this.toggleShortcutsModal(false);
      this.handleAction('clear');
    } else if (key.toLowerCase() === 's') {
      e.preventDefault();
      this.handleAction('function', 'sin');
    } else if (key.toLowerCase() === 'c') {
      e.preventDefault();
      this.handleAction('function', 'cos');
    } else if (key.toLowerCase() === 't') {
      e.preventDefault();
      this.handleAction('function', 'tan');
    } else if (key.toLowerCase() === 'l') {
      e.preventDefault();
      this.handleAction('function', 'log');
    } else if (key.toLowerCase() === 'n') {
      e.preventDefault();
      this.handleAction('function', 'ln');
    } else if (key.toLowerCase() === 'r') {
      e.preventDefault();
      this.handleAction('function', 'sqrt');
    } else if (key.toLowerCase() === 'p') {
      e.preventDefault();
      this.handleAction('constant', 'pi');
    } else if (key.toLowerCase() === 'e') {
      e.preventDefault();
      this.handleAction('constant', 'e');
    } else if (key === '!') {
      e.preventDefault();
      this.handleAction('factorial');
    }
  }

  highlightKey(key) {
    let selector = null;
    if (/[0-9]/.test(key)) {
      selector = `[data-action="number"][data-value="${key}"]`;
    } else if (key === '.') {
      selector = `[data-action="decimal"]`;
    } else if (key === '+') {
      selector = `[data-action="operator"][data-value="+"]`;
    } else if (key === '-') {
      selector = `[data-action="operator"][data-value="−"]`;
    } else if (key === '*') {
      selector = `[data-action="operator"][data-value="×"]`;
    } else if (key === '/') {
      selector = `[data-action="operator"][data-value="÷"]`;
    } else if (key === 'Enter' || key === '=') {
      selector = `[data-action="equals"]`;
    } else if (key === 'Backspace') {
      selector = `[data-action="delete"]`;
    } else if (key === 'Escape') {
      selector = `[data-action="clear"]`;
    }

    if (selector) {
      const btn = document.querySelector(selector);
      if (btn) this.triggerButtonRipple(btn);
    }
  }

  // ==========================================
  // Modern Clipboard API
  // ==========================================
  async copyToClipboard(text, successMsg = 'Copied!') {
    if (!text || text === ' ') {
      this.showToast('Nothing to copy');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        this.showToast(successMsg);
      } else {
        // Fallback for non-secure contexts or restrictive iframes
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          this.showToast(successMsg);
        } else {
          this.showToast('Unable to copy to clipboard');
        }
      }
    } catch (err) {
      this.showToast('Failed to copy to clipboard');
    }
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.add('toast-visible');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('toast-visible');
    }, 2200);
  }

  // ==========================================
  // Theme Management
  // ==========================================
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('calc_theme', theme);

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      if (theme === 'dark') {
        // Show Moon icon or Sun icon for toggling to light
        themeIcon.innerHTML = `
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        `;
      } else {
        themeIcon.innerHTML = `
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        `;
      }
    }
  }

  updateSoundIcon() {
    const icon = document.getElementById('sound-icon');
    if (!icon) return;
    if (this.sound.enabled) {
      icon.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    } else {
      icon.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      `;
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        this.showToast('Fullscreen mode not available in preview iframe');
      });
    } else {
      document.exitFullscreen?.();
    }
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.calcApp = new CalculatorApp();

  // Unregister any old service workers if present
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => reg.unregister());
    }).catch(() => {});
  }
});

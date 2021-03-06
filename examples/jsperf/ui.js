/*!
 * ui.js
 * Copyright Mathias Bynens <http://mths.be/>
 * Modified by John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <http://mths.be/mit>
 */
(function(window, document) {

  /** Java applet archive path */
  var archive = '../../nano.jar',

  /** Google Analytics account id */
  gaId = '',

  /** Benchmark results element id prefix (e.g. `results-1`) */
  prefix = 'results-',

  /** Object containing various css class names */
  classNames = {

    /** CSS class name used for error styles */
    'error': 'error',

    /** CSS class name used to make content visible */
    'show': 'show',

    /** CSS class name used to reset result styles */
    'results': 'results'
  },

  /** Object containing various text messages */
  texts = {

    /** Inner text for the various run button states */
    'run': {
      'ready': 'Run tests',
      'again': 'Run again',
      'running': 'Stop running'
    },

    /** Common status values */
    'status': {
      'ready': 'Ready to run.',
      'again': 'Done. Ready to run again.'
    }
  },

  /** Used to flag environments/features */
  has = {
    'localStorage': !!function() {
      try {
        return !localStorage.getItem(+new Date);
      } catch(e) {}
    }()
  },

  /** Cache of error messages */
  errors = [],

  /** Cache of event handlers */
  handlers = {},

  /** A flag to indicate that the page has loaded */
  loaded = false,

  /** The element responsible for scrolling the page (assumes ui.js is just before </body>) */
  scrollEl = document.body,

  /** Namespace */
  ui = new Benchmark.Suite,

  /** API Shortcuts */
  each = Benchmark.each,
  filter = Benchmark.filter,
  forIn = Benchmark.forIn,
  formatNumber = Benchmark.formatNumber,
  indexOf = Benchmark.indexOf;

  /*--------------------------------------------------------------------------*/

  handlers.benchmark = {

    /**
     * The onCycle callback, used for onStart as well, assigned to new benchmarks.
     * @private
     */
    'cycle': function() {
      var bench = this,
          size = bench.stats.size;

      if (!bench.aborted) {
        setStatus(bench.name + ' &times; ' + formatNumber(bench.count) + ' (' +
          size + ' sample' + (size == 1 ? '' : 's') + ')');
      }
    }
  };

  handlers.button = {

    /**
     * The "run" button click event handler used to run or abort the benchmarks.
     * @private
     */
    'run': function() {
      var stopped = !ui.running;
      ui.abort();
      ui.length = 0;

      if (stopped) {
        logError(false);
        ui.push.apply(ui, filter(ui.benchmarks, function(bench) { return !bench.error; }));
        ui.run(true, true);
      }
    }
  };

  handlers.title = {

    /**
     * The title table cell click event handler used to run the corresponding benchmark.
     * @private
     * @param {Object} event The event object.
     */
    'click': function(event) {
      event || (event = window.event);

      var id,
          index,
          target = event.target || event.srcElement;

      while (target && !(id = target.id)) {
        target = target.parentNode;
      }
      index = id && --id.split('-')[1] || 0;
      ui.push(ui.benchmarks[index].reset());
      ui.running ? ui.render(index) : ui.run(true, true);
    },

    /**
     * The title cell keyup event handler used to simulate a mouse click when hitting the ENTER key.
     * @private
     * @param {Object} event The event object.
     */
    'keyup': function(event) {
      if (13 == (event || window.event).keyCode) {
        handlers.title.click(event);
      }
    }
  };

  handlers.window = {

    /**
     * The window hashchange event handler supported by Chrome 5+, Firefox 3.6+, and IE8+.
     * @private
     */
    'hashchange': function() {
      ui.parseHash();

      var scrollTop,
          params = ui.params,
          chart = params.chart,
          filterBy = params.filterby;

      if (loaded) {
        // configure posting
        ui.browserscope.postable = !('nopost' in params);

        // call user provided init() function
        if (typeof window.init == 'function') {
          init();
        }
        // configure chart renderer
        if (chart || filterBy) {
          scrollTop = $('results').offsetTop;
          ui.browserscope.render({ 'chart': chart, 'filterBy': filterBy });
        }
        // call user provided init() function
        if (typeof window.init == 'function') {
          init();
        }
        // auto-run
        if ('run' in params) {
          scrollTop = $('runner').offsetTop;
          setTimeout(handlers.button.run, 1);
        }
        // scroll to the relevant section
        if (scrollTop) {
          scrollEl.scrollTop = scrollTop;
        }
      }
    },

    /**
     * The window load event handler used to initialize the UI.
     * @private
     */
    'load': function() {
      // init the ui
      addClass('controls', classNames.show);
      addListener('run', 'click', handlers.button.run);

      setHTML('run', texts.run.ready);
      setHTML('user-agent', Benchmark.platform);
      setStatus(texts.status.ready);

      // answer spammer question
      $('question').value = 'no';

      // prefill author details
      if (has.localStorage) {
        each([$('author'), $('author-email'), $('author-url')], function(element) {
          element.value = localStorage[element.id] || '';
          element.oninput = element.onkeydown = function(event) {
            event && event.type < 'k' && (element.onkeydown = null);
            localStorage[element.id] = element.value;
          };
        });
      }
      // show warning when Firebug is enabled (avoids showing for Firebug Lite)
      if (typeof window.console != 'undefined' && typeof console.firebug != 'undefined') {
        addClass('firebug', classNames.show);
      }
      // evaluate hash values
      // (delay in an attempt to ensure this is executed after all other window load handlers)
      setTimeout(function() {
        loaded = true;
        handlers.window.hashchange();
      }, 1);
    }
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Shortcut for document.getElementById().
   * @private
   * @param {Element|String} id The id of the element to retrieve.
   * @returns {Element} The element, if found, or null.
   */
  function $(id) {
    return typeof id == 'string' ? document.getElementById(id) : id;
  }

  /**
   * Adds a CSS class name to an element's className property.
   * @private
   * @param {Element|String} element The element or id of the element.
   * @param {String} className The class name.
   * @returns {Element} The element.
   */
  function addClass(element, className) {
    if (!hasClass(element = $(element), className)) {
      element.className += (element.className ? ' ' : '') + className;
    }
    return element;
  }

  /**
   * Registers an event listener on an element.
   * @private
   * @param {Element|String} element The element or id of the element.
   * @param {String} eventName The name of the event.
   * @param {Function} handler The event handler.
   * @returns {Element} The element.
   */
  function addListener(element, eventName, handler) {
    element = $(element);
    if (typeof element.addEventListener != 'undefined') {
      element.addEventListener(eventName, handler, false);
    } else if (element.attachEvent != 'undefined') {
      element.attachEvent('on' + eventName, handler);
    }
    return element;
  }

  /**
   * Appends to an element's innerHTML property.
   * @private
   * @param {Element|String} element The element or id of the element.
   * @param {String} html The HTML to append.
   * @returns {Element} The element.
   */
  function appendHTML(element, html) {
    if ((element = $(element)) && html != null) {
      element.innerHTML += html;
    }
    return element;
  }

  /**
   * Shortcut for document.createElement().
   * @private
   * @param {String} tag The tag name of the element to create.
   * @returns {Element} A new element of the given tag name.
   */
  function createElement(tagName) {
    return document.createElement(tagName);
  }

  /**
   * Checks if an element is assigned the given class name.
   * @private
   * @param {Element|String} element The element or id of the element.
   * @param {String} className The class name.
   * @returns {Boolean} If assigned the class name return true, else false.
   */
  function hasClass(element, className) {
    return (' ' + $(element).className + ' ').indexOf(' ' + className + ' ') > -1;
  }

  /**
   * Set an element's innerHTML property.
   * @private
   * @param {Element|String} element The element or id of the element.
   * @param {String} html The HTML to set.
   * @returns {Element} The element.
   */
  function setHTML(element, html) {
    if ((element = $(element))) {
      element.innerHTML = html == null ? '' : html;
    }
    return element;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Appends to or clears the error log.
   * @private
   * @param {String|Boolean} text The text to append or `false` to clear.
   */
  function logError(text) {
    var table,
        div = $('error-info');

    if (!div) {
      table = $('test-table');
      div = createElement('div');
      div.id = 'error-info';
      table.parentNode.insertBefore(div, table.nextSibling);
    }
    if (text === false) {
      div.className = div.innerHTML = '';
      errors.length = 0;
    }
    else {
      if (indexOf(errors, text) < 0) {
        errors.push(text);
        addClass(div, classNames.show);
        appendHTML(div, text);
      }
    }
  }

  /**
   * Sets the status text.
   * @private
   * @param {String} text The text to write to the status.
   */
  function setStatus(text) {
    setHTML('status', text);
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Parses the window.location.hash value into an object assigned to `ui.params`.
   * @static
   * @memberOf ui
   * @returns {Object} The suite instance.
   */
  function parseHash() {
    var me = this,
        hashes = location.hash.slice(1).split('&'),
        params = me.params || (me.params = {});

    // remove old params
    forIn(params, function(value, key) {
      delete params[key];
    });

    // add new params
    each(hashes[0] && hashes, function(value) {
      value = value.split('=');
      params[value[0].toLowerCase()] = (value[1] || '').toLowerCase();
    });
    return me;
  }

  /**
   * Renders the results table cell of the corresponding benchmark(s).
   * @static
   * @memberOf ui
   * @param {Number} [index] The index of the benchmark to render.
   * @returns {Object} The suite instance.
   */
  function render(index) {
    each(index == null ? (index = 0, ui.benchmarks) : [ui.benchmarks[index]], function(bench) {
      var parsed,
          cell = $(prefix + (++index)),
          error = bench.error,
          hz = bench.hz;

      // reset title and class
      cell.title = '';
      cell.className = classNames.results;

      // status: error
      if (error) {
        setHTML(cell, 'Error');
        addClass(cell, classNames.error);
        parsed = Benchmark.join(error, '</li><li>');
        logError('<p>' + error + '.</p>' + (parsed ? '<ul><li>' + parsed + '</li></ul>' : ''));
      }
      else {
        // status: running
        if (bench.running) {
          setHTML(cell, 'running&hellip;');
        }
        // status: finished
        else if (bench.cycles) {
          cell.title = 'Ran ' + formatNumber(bench.count) + ' times in ' +
            bench.times.cycle.toFixed(3) + ' seconds.';
          setHTML(cell, formatNumber(hz.toFixed(hz < 100 ? 2 : 0)) +
            ' <small>&plusmn;' + bench.stats.rme.toFixed(2) + '%</small>');
        }
        else {
          // status: pending
          if (ui.running && ui.indexOf(bench) > -1) {
            setHTML(cell, 'pending&hellip;');
          }
          // status: ready
          else {
            setHTML(cell, 'ready');
          }
        }
      }
    });
    return ui;
  }

  /*--------------------------------------------------------------------------*/

  ui.on('add', function(event, bench) {
    var index = ui.benchmarks.length,
        id = index + 1,
        title = $('title-' + id);

    title.tabIndex = 0;
    title.title = 'Click to run this test again.';

    addListener(title, 'click', handlers.title.click);
    addListener(title, 'keyup', handlers.title.keyup);
    bench.on('start cycle', handlers.benchmark.cycle);

    delete ui[--ui.length];
    ui.benchmarks.push(bench);
    ui.render(index);
  })
  .on('start cycle', function() {
    ui.render();
    setHTML('run', texts.run.running);
  })
  .on('complete', function() {
    var benches = filter(ui.benchmarks, 'successful'),
        fastest = filter(benches, 'fastest'),
        slowest = filter(benches, 'slowest');

    ui.render();
    setHTML('run', texts.run.again);
    setStatus(texts.status.again);

    each(benches, function(bench) {
      var percent,
          text = 'fastest',
          cell = $(prefix + (indexOf(ui.benchmarks, bench) + 1)),
          span = cell.getElementsByTagName('span')[0];

      if (indexOf(fastest, bench) > -1) {
        // mark fastest
        addClass(cell, text);
      }
      else {
        percent = Math.round((1 - bench.hz / fastest[0].hz) * 100);
        text = percent + '% slower';

        // mark slowest
        if (indexOf(slowest, bench) > -1) {
          addClass(cell, 'slowest');
        }
      }
      // write ranking
      if (span) {
        setHTML(span, text);
      } else {
        appendHTML(cell, '<span>' + text + '</span>');
      }
    });

    ui.browserscope.post();
  });

  /*--------------------------------------------------------------------------*/

  /**
   * An array of benchmarks created from test cases.
   * @memberOf ui
   * @type Array
   */
  ui.benchmarks = [];

  /**
   * The parsed query parameters of the pages url hash.
   * @memberOf ui
   * @type Object
   */
  ui.params = {};

  // parse query params into ui.params hash
  ui.parseHash = parseHash;

  // (re)render the results of one or more benchmarks
  ui.render = render;

  /*--------------------------------------------------------------------------*/

  // expose
  window.ui = ui;

  // don't let users alert, confirm, prompt, or open new windows
  window.alert = window.confirm = window.prompt = window.open = function() { };

  // parse hash query params when it changes
  addListener(window, 'hashchange', handlers.window.hashchange);

  // bootstrap onload
  addListener(window, 'load', handlers.window.load);

  // parse location hash string
  ui.parseHash();

  // detect the scroll element
  (function() {
    var div = document.createElement('div'),
        body = document.body,
        bodyStyle = body.style,
        bodyHeight = bodyStyle.height,
        html = document.documentElement,
        htmlStyle = html.style,
        htmlHeight = htmlStyle.height,
        scrollTop = html.scrollTop;

    bodyStyle.height  = htmlStyle.height = 'auto';
    div.style.cssText = 'display:block;height:8500px;';
    body.insertBefore(div, body.firstChild);

    // set `scrollEl` that's used in `handlers.window.hashchange()`
    if (html.clientWidth !== 0 && ++html.scrollTop && html.scrollTop == scrollTop + 1) {
      scrollEl = html;
    }
    body.removeChild(div);
    bodyStyle.height = bodyHeight;
    htmlStyle.height = htmlHeight;
    html.scrollTop = scrollTop;
  }());

  // inject nano applet
  // (assumes ui.js is just before </body>)
  (function() {
    var body = document.body;
    if ('nojava' in ui.params) {
      addClass('java', classNames.show);
    } else {
      body.insertBefore(setHTML(createElement('div'),
        '<applet code=nano archive=' + archive + '>').lastChild, body.firstChild);
    }
  }());

  // provide a simple UI for toggling between chart types and filtering results
  // (assumes ui.js is just before </body>)
  (function() {
    var sibling = $('bs-results'),
        p = createElement('p');

    p.innerHTML =
      '<span id=charts><strong>Chart type:</strong> <a href=#>bar</a>, ' +
      '<a href=#>column</a>, <a href=#>line</a>, <a href=#>pie</a>, ' +
      '<a href=#>table</a></span><br>' +
      '<span id=filters><strong>Filter:</strong> <a href=#>popular</a>, ' +
      '<a href=#>all</a>, <a href=#>desktop</a>, <a href=#>major</a>, ' +
      '<a href=#>minor</a>, <a href=#>mobile</a>, <a href=#>prerelease</a></span>';

    sibling.parentNode.insertBefore(p, sibling);

    // use DOM0 event handler to simplify canceling the default action
    $('charts').onclick =
    $('filters').onclick = function(event) {
      event || (event = window.event);
      var target = event.target || event.srcElement;
      if (target.href || (target = target.parentNode).href) {
        ui.browserscope.render(
          target.parentNode.id == 'charts'
            ? { 'chart': target.innerHTML }
            : { 'filterBy': target.innerHTML }
        );
      }
      // cancel the default action
      return false;
    };
  }());

  // inject /dart notice for Android/Chrome
  // (recycle other elements/styles for now)
  if (/Android|Chrome/.test(Benchmark.platform)) {
    setHTML('java', '<strong>Is Google JavaScript’s BFF? Check out the <a href="http://jsperf.com/dart">Dart summary</a>.</strong>');
    addClass('java', classNames.show);
  }
  // optimized asynchronous Google Analytics snippet based on
  // http://mathiasbynens.be/notes/async-analytics-snippet
  if (gaId) {
    (function() {
      var script = createElement('script'),
          sibling = document.getElementsByTagName('script')[0];

      window._gaq = [['_setAccount', gaId], ['_trackPageview']];
      script.src = '//www.google-analytics.com/ga.js';
      sibling.parentNode.insertBefore(script, sibling);
    }());
  }
}(this, document));
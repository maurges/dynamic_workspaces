// This scripts relies on two things:
// 1. `workspace.desktops` and `client.desktops` giving me desktops in the same
//   order as in pager and all context menus
// 2. Desktops being comparable for equality with `==` operator

// Desktop numbers are from zero (unlike how it worked in plasma 5)

const MIN_DESKTOPS = 2;
const LOG_LEVEL = 2; // 0 trace, 1 debug, 2 info

function log(...args) {
  print("[dynamic_workspaces] ", ...args);
}
function debug(...args) {
  if (LOG_LEVEL <= 1) log(...args);
}
function trace(...args) {
  if (LOG_LEVEL <= 0) log(...args);
}

function appendDesktop(client) {
  const lastDesktop = workspace.desktops[workspace.desktops.length - 1];
  if (client.desktops.indexOf(lastDesktop) !== -1) {
    workspace.createDesktop(workspace.desktops.length, undefined);
  }
}

/**
 * Checks for new created or moved windows if they are occupying the last desktop
 * -> if yes, create new one to the right
 */
function onDesktopChangedFor(client) {
  trace(`onDesktopChangedFor(${client.caption})`);

  appendDesktop(client);
}

/**
 * When creating new windows, check whether they are occupying the last desktop
 */
function onClientAdded(client) {
  if (client === null) {
    log("onClientAdded(null) - that may happen rarely");
    return;
  }
  trace(`onClientAdded(${client.caption})`);

  if (client.skipPager) {
    debug("Ignoring added hidden window");
    return;
  }

  // add a new desktop for a client too right
  appendDesktop(client);

  // subscribe the client to create desktops when desktop switched
  client.desktopsChanged.connect(() => {
    onDesktopChangedFor(client);
  });
}

// tells if desktop has no windows of its own
function isEmptyDesktop(desktop, number) {
  trace(`isEmptyDesktop(${number})`);
  const cls = workspace.windowList();
  let result = true;
  for (client of cls) {
    if (
      client.desktops.indexOf(desktop) !== -1 &&
      !client.skipPager && // ignore hidden windows
      !client.onAllDesktops // ignore windows on all desktops
    ) {
      debug(`Desktop ${number} not empty because ${client.caption} is there`);
      result = false;
      break;
    }
  }
  return result;
}

function removeAllEmptyDesktops() {
  const allDesktops = workspace.desktops;
  const desktopsLength = workspace.desktops.length;
  const currentDesktopIndex = allDesktops.indexOf(workspace.currentDesktop);

  let _toRemove = [];
  if (MIN_DESKTOPS >= desktopsLength) return;
  for (let dIdx = 0; dIdx < desktopsLength - 1; dIdx++) {
    if (dIdx !== currentDesktopIndex) {
      const _desktop = workspace.desktops[dIdx];
      if (isEmptyDesktop(_desktop, dIdx)) {
        /**
         * we collect all empty desktops indexes
         */
        _toRemove.push(_desktop);
      }
    }
  }
  for (let rIdx = 0; rIdx < _toRemove.length; rIdx++) {
    if (MIN_DESKTOPS >= workspace.desktops.length) break;
    workspace.removeDesktop(_toRemove[rIdx]);
  }
}

// Adding or removing a client might create desktops.
// For all existing clients:
workspace.windowList().forEach(onClientAdded);
// And for all future clients:
workspace.windowAdded.connect(onClientAdded);

// Switching desktops might remove desktops
workspace.currentDesktopChanged.connect(removeAllEmptyDesktops);

removeAllEmptyDesktops();

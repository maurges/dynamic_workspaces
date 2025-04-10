// This scripts relies on two things:
// 1. `workspace.desktops` and `client.desktops` giving me desktops in the same
//   order as in pager and all context menus
// 2. Desktops being comparable for equality with `==` operator

// Desktop numbers are from zero (unlike how it worked in plasma 5)


const MIN_DESKTOPS = readConfig("minDesktops", 2);
const KEEP_EMPTY_MIDDLE_DESKTOPS = readConfig("keepEmptyMiddleDesktops", false);
const LOG_LEVEL = 2; // 0 trace, 1 debug, 2 info


function log(...args) { print("[dynamic_workspaces] ", ...args); }
function debug(...args) { if (LOG_LEVEL <= 1)  log(...args); }
function trace(...args) { if (LOG_LEVEL <= 0)  log(...args); }


/*****  Plasma 5/6 differences  *****/


const isKde6 = typeof workspace.windowList === "function";
const compat = isKde6
	?
		{ addDesktop = () =>
			{ workspace.createDesktop(workspace.desktops.length, undefined); }
		, windowAddedSignal = ws => ws.windowAdded
		, windowList = ws => ws.windowList()
		, desktopChangedSignal = c => c.desktopsChanged

		, toDesktop = d => d
		, workspaceDesktops = () => workspace.desktops
		, lastDesktop = () => workspace.desktops[workspace.desktops.length - 1]
		, deleteLastDesktop = () =>
			{
				const last = workspace.desktops[workspace.desktops.length - 1];
				workspace.removeDesktop(last);
			}
		, findDesktop = (ds, d) => ds.indexOf(d)

		, clientDesktops = c => c.desktops
		, setClientDesktops = (c, ds) =>
			{
				c.desktops = ds;
			}
		, clientOnDesktop = (c, d) => c.desktops.indexOf(d) !== -1
		}
	:
		{ addDesktop = () =>
			{ workspace.createDesktop(workspace.desktops, "dyndesk"); }
		, windowAddedSignal = ws => ws.clientAdded
		, windowList = ws => ws.clientList()
		, desktopChangedSignal = c => c.desktopChanged

		// emulate plasma 6 behaviour with custom types
		, toDesktop = number => {{ index: number - 1 }}
		, workspaceDesktops = () =>
			{
				let r = [];
				for (let i = 0; i < workspace.desktops; ++i)
				{
					const desktop =
						{ index: i
						};
					r.push(desktop);
				}
				return r;
			}
		, lastDesktop = () => {{ index: workspace.desktops - 1 }}
		, deleteLastDesktop = () =>
			{ workspace.removeDesktop(workspace.desktops - 1); }
		, findDesktop = (ds, d) =>
			{
				for (let i = 0; i < ds.length; ++i)
				{
					if (ds[i].index === d.index)
					{
						return i;
					}
				}
				return -1;
			}

		, clientDesktops = c =>
			c
				.x11DesktopIds
				.map(id => {return {index: id - 1}})
		, setClientDesktops = (c, ds) =>
			{
				// Plasma 5 is supports window on multiple desktops, and there
				// are even functions for it in the API, but they are bugged.
				// So we have to do this. So far, noone has complained, so
				// maybe noone uses this feature?
				c.desktop = ds[0];
			}
		, clientOnDesktop = (c, d) => c.desktop === d.index + 1
		};


/*****  Logic definition  *****/


// shifts a window to the left if it's more to the right than number
function shiftRighterThan(client, number)
{
	trace(`shiftRighterThan(${client.caption}, ${number})`);
	if (number === 0)  return;
	// Build a new array by comparing old client desktops with all available
	// desktops
	const allDesktops = compat.workspaceDesktops();
	const clientDesktops = compat.clientDesktops(client);
	let newDesktops = [];
	// first add unchanged desktops
	for (let i = 0; i < number; ++i)
	{
		const d = allDesktops[i];
		if (compat.findDesktop(clientDesktops, d) !== -1)
		{
			newDesktops.push(d);
		}
	}
	// then for every desktop after `number`, add a desktop before that
	for (let i = number; i < allDesktops.length; ++i)
	{
		const d = allDesktops[i];
		if (compat.findDesktop(clientDesktops, d) !== -1)
		{
			newDesktops.push(allDesktops[i-1]);
		}
	}

	compat.setClientDesktops(client, newDesktops);
}

/**
 * Delete a desktop by index
 *
 * @returns true if desktop was deleted, false if wasn't
 */
function removeDesktop(number)
{
	trace(`removeDesktop(${number})`);

	const desktopsLength = compat.workspaceDesktops().length;
	if (desktopsLength - 1 <= number)
	{
		debug("Not removing desktop at end");
		return false;
	}
	if (desktopsLength <= MIN_DESKTOPS)
	{
		debug("Not removing desktop, too few left");
		return false;
	}

	// plasma6 allows us to delete desktops in the middle. Unfortunately, this
	// messes up pager, so we have to do what we did un plasma5 and shift all
	// windows by hand to delete the last desktop
	compat.windowList(workspace).forEach((client) =>
	{
		shiftRighterThan(client, number)
	});
	compat.deleteLastDesktop();
	debug("Desktop removed");
	return true;
}

// tells if desktop has no windows of its own
function isEmptyDesktop(number)
{
	trace(`isEmptyDesktop(${number})`)
	const desktop = compat.workspaceDesktops()[number];
	const cls = compat.windowList(workspace);
	for (client of cls)
	{
		if (compat.clientOnDesktop(client, desktop)
			&& !client.skipPager // ignore hidden windows
			&& !client.onAllDesktops // ignore windows on all desktops
		) {
			debug(`Desktop ${number} not empty because ${client.caption} is there`);
			return false;
		}
	}

	return true;
}

/**
 * Checks for new created or moved windows if they are occupying the last desktop
 * -> if yes, create new one to the right
 */
function onDesktopChangedFor(client)
{
	trace(`onDesktopChangedFor(${client.caption})`);

	const lastDesktops = compat.lastDesktop();
	if (compat.clientOnDesktop(client, lastDesktops))
	{
		compat.addDesktop();
	}
}

/**
 * When creating new windows, check whether they are occupying the last desktop
 */
function onClientAdded(client)
{
	if (client === null)
	{
		log("onClientAdded(null) - that may happen rarely");
		return;
	}
	trace(`onClientAdded(${client.caption})`);

	if (client.skipPager)
	{
		debug("Ignoring added hidden window");
		return;
	}

	// add a new desktop for a client too right
	if (compat.clientOnDesktop(client, compat.lastDesktop()))
	{
		compat.addDesktop();
	}

	// subscribe the client to create desktops when desktop switched
	compat.desktopChangedSignal(client).connect(() => { onDesktopChangedFor(client); });
}

/**
 * Deletes empty desktops to the right in case of a left switch
 */
function onDesktopSwitch(oldDesktop)
{
	trace(`onDesktopSwitch(${oldDesktop})`);

	const allDesktops = compat.workspaceDesktops();
	const oldDesktopIndex = compat.findDesktop(allDesktops, compat.toDesktop(oldDesktop));
	const currentDesktopIndex = compat.findDesktop(allDesktops, compat.toDesktop(workspace.currentDesktop));
	const getDesktopsLength = () => compat.workspaceDesktops().length;

	if (oldDesktopIndex <= currentDesktopIndex)
	{
		debug("Desktop switched to the right - ignoring");
		return;
	}

	// Calculate the index of the last desktop we want to preserve when cleaning up.
	// We need to preserve:
	//   1. The current desktop (currentDesktopIndex)
	//   2. At least MIN_DESKTOPS. Note we actually subtract two because:
	//      - We always have the dynamic empty desktop at the end 
	//      - MIN_DESKTOPS is a count, but we need an index
	const preserveUpToIndex = Math.max(currentDesktopIndex, MIN_DESKTOPS - 2);
	
	// Loop through desktops right-to-left and delete empty ones:
	// - Starts from second-to-last desktop (preserving always one empty desktop at the end)
	// - Stops before reaching current desktop (preserves what user is viewing)
	// - Stops before reaching minimum number of desktops
	// To prevent an infinite loop caused by abnormal conditions (e.g. interference with other plugins),
	// we only examine as many desktops as we initially detect.
	for (let desktopIdx = getDesktopsLength() - 2; desktopIdx > preserveUpToIndex; --desktopIdx)
	{
		debug(`Examine desktop ${desktopIdx}`);
		if (isEmptyDesktop(desktopIdx))
		{
			removeDesktop(desktopIdx);
		}
		else if (KEEP_EMPTY_MIDDLE_DESKTOPS)
		{
			debug("Found non-empty desktop, stopping purge");
			break;
		}
	}
}


/*****  Main part *****/


// Adding or removing a client might create desktops.
// For all existing clients:
compat.windowList(workspace).forEach(onClientAdded);
// And for all future clients:
compat.windowAddedSignal(workspace).connect(onClientAdded);

// Switching desktops might remove desktops
workspace.currentDesktopChanged.connect(onDesktopSwitch);

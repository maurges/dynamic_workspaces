// This scripts relies on two things:
// 1. `workspace.desktops` and `client.desktops` giving me desktops in the same
//   order as in pager and all context menus
// 2. Desktops being comparable for equality with `==` operator

const MIN_DESKTOPS = 2;

const isKde6 = typeof workspace.windowList === "function";
const compat = isKde6
	?
		{ addDesktop = () =>
			{ workspace.createDesktop(workspace.desktops.length, "dyndesk"); }
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
		, clientOnDesktop = (c, d) => client.desktops.indexOf(d) !== -1
		}
	:
		{ addDesktop = () =>
			{ workspace.desktops += 1; }
		, windowAddedSignal = ws => ws.clientAdded
		, windowList = ws => ws.clientList()
		, desktopChangedSignal = c => c.desktopChanged

		// emulate plasma 6 behaviour with custom types
		, toDesktop = number =>
			{
				return
					{ index: number - 1;
					}
			}
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
		, lastDesktop = () =>
			{
				return { index: workspace.desktops - 1
				       };
			}
		, deleteLastDesktop = () =>
			{ workspace.removeDesktop(workspace.desktops - 1); }
		, findDesktop = (ds, d) =>
			{
				for (let i = 0; i < ds.length; ++i)
				{
					if (ds[i].index == d.index)
					{
						return i;
					}
				}
				return -1;
			}

		, clientDesktops = c =>
			{
				return [ { index: c.desktop - 1
				         }
				       ]
			}
		, setClientDesktops = (c, ds) =>
			{
				c.desktop = ds[0];
			}
		, clientOnDesktop = (c, d) => c.desktop === d.index + 1
		};

function log(...args)
{
	print("[dynamic_workspaces] ", ...args);
}

// shifts a window to the left if it's more to the right than number
function shift_righter_than(client, number)
{
	// Build a new array by comparing old client desktops with all available
	// desktops
	const all_desktops = compat.workspaceDesktops();
	const client_desktops = compat.clientDesktops(client);
	let new_desktops = [];
	// first add unchanged desktops
	for (let i = 0; i <= number; ++i)
	{
		const d = all_desktops[i];
		if (compat.findDesktop(client_desktops, d) != -1)
		{
			new_desktops.push(d);
		}
	}
	// then for every desktop after `number`, add a desktop before that
	for (let i = number + 1; i < all_desktops.length; ++i)
	{
		const d = all_desktops[i];
		if (compat.findDesktop(client_desktops, d) != -1)
		{
			new_desktops.push(all_desktops[i-1]);
		}
	}

	compat.setClientDesktops(client, new_desktops);
}

/**
 * Delete a desktop by number
 * Returns true if desktop was deleted, false if wasn't
 * @returns true if removed
 */
function remove_desktop_with(number)
{
	log(`remove_desktop_with(${number})`);

	const desktopsLength = compat.workspaceDesktops().length;
	// don't do anything if below minimum desktops
	if (desktopsLength <= MIN_DESKTOPS) return false;
	// do not remove empty desktop at the end
	if (desktopsLength - 1 == number) return false;

	// plasma6 allows us to delete desktops in the middle. Unfortunately, this
	// messes up pager, so we have to do what we did un plasma5 and shift all
	// windows by hand to delete the last desktop
	compat.windowList(workspace).forEach((client) =>
	{
		shift_righter_than(client, number)
	});
	compat.deleteLastDesktop();
	return true;
}

// tells if desktop has no windows of its own
function is_empty_desktop(number)
{
	const desktop = compat.workspaceDesktops()[number];
	log(`is_empty_desktop(${number})`)
	const cls = compat.windowList(workspace);
	cls.forEach(client =>
	{
		// is client on desktop?
		if (compat.clientOnDesktop(client, desktop) !== -1
			&& !client.skipPager // ignore hidden windows
			&& !client.onAllDesktops // ignore windows on all desktops
		) {
			log(`Desktop ${number} not empty because ${client.caption} is there`);
			return false;
		}
	});

	return true;
}

/**
 * Checks for new created or moved windows if they are occupying the last desktop
 * -> if yes, create new one to the right
 */
function desktop_changed_for(client)
{
	log(`desktop_changed_for() -> Client ${client.caption} just moved`);

	const last_desktop = compat.lastDesktop();
	if (compat.clientOnDesktop(client, last_desktop) != -1)
	{
		compat.addDesktop();
	}
}

/**
 * When creating new windows, check whether they are occupying the last desktop
 */
function on_client_added(client)
{
	if (client === null)
	{
		// just in case
		return;
	}

	if (client.skipPager)
	{
		//ignore hidden windows
		return;
	}

	// add a new desktop for a client too right
	const last_desktop = compat.lastDesktop();
	if (compat.clientOnDesktop(client, last_desktop) != -1)
	{
		compat.addDesktop();
	}

	// subscribe the client to create desktops when desktop switched
	compat.desktopChangedSignal(client).connect(() => { desktop_changed_for(client); });
}

/**
 * Deletes empty desktops to the right in case of a left switch
 */
function on_desktop_switch(old_desktop)
{
	log(`on_desktop_switch(${old_desktop})`);

	const allDesktops = compat.workspaceDesktops();
	const old_desktop_index = compat.findDesktop(allDesktops, compat.toDesktop(old_desktop));
	const current_desktop_index = compat.findDesktop(allDesktops, compat.toDesktop(workspace.currentDesktop));

	// do nothing if we switched to the right
	if (old_desktop_index <= current_desktop_index) return;

	// start from next desktop to the right
	let desktop_idx = current_desktop_index + 1;

	// prevent infinite loop in case of an error - only try as many times as there are desktops.
	// Might save us if other plugins interfere with workspace creation/deletion
	let loop_counter = 0;
	const desktopsLength = compat.workspaceDesktops().length;
	for (; desktop_idx < desktopsLength && loop_counter < desktopsLength; ++desktop_idx)
	{
		loop_counter += 1;
		if (is_empty_desktop(desktop_idx))
		{
			const success = remove_desktop_with(desktop_idx);
			if (success)
			{
				// we removed a desktop so we need to reduce our counter also
				desktop_idx -= 1;
			}
		}
	}
}


/*****  Main part *****/


// actions relating to creating desktops
// also this subscribes all clients to their desktopsChanged event
compat.windowAddedSignal(workspace).connect(on_client_added);
// also do this for all existing clients
compat.windowList(workspace).forEach(on_client_added);

// handle change desktop events
workspace.currentDesktopChanged.connect((old_desktop) => { on_desktop_switch(old_desktop); });

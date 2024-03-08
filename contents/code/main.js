// This scripts relies on two things:
// 1. `workspace.desktops` and `client.desktops` giving me desktops in the same
//   order as in pager and all context menus
// 2. Desktops being comparable for equality with `==` operator

const MIN_DESKTOPS = 2;

function log(...args)
{
	print("[dynamic_workspaces] ", ...args);
}

function add_desktop()
{
	log("add_desktop()");
	workspace.createDesktop(workspace.desktops.length, "dyndesk");
}

// shifts a window to the left if it's more to the right than number
function shift_righter_than(client, number)
{
	// Build a new array by comparing old client desktops with all available
	// desktops
	const all_desktops = workspace.desktops;
	const client_desktops = client.desktops;
	let new_desktops = [];
	// first add unchanged desktops
	for (let i = 0; i <= number; ++i)
	{
		const d = all_desktops[i];
		if (client_desktops.indexOf(d) != -1)
		{
			new_desktops.push(d);
		}
	}
	// then for every desktop after `number`, add a desktop before that
	for (let i = number + 1; i < all_desktops.length; ++i)
	{
		const d = all_desktops[i];
		if (client_desktops.indexOf(d) != -1)
		{
			new_desktops.push(all_desktops[i-1]);
		}
	}

	client.desktops = new_desktops;
}

/**
 * Delete a desktop by number
 * Returns true if desktop was deleted, false if wasn't
 * @returns true if removed
 */
function remove_desktop_with(number)
{
	log(`remove_desktop_with(${number})`);

	// don't do anything if below minimum desktops
	if (workspace.desktops.length <= MIN_DESKTOPS) return false;

	// do not remove empty desktop at the end
	if (workspace.desktops.length - 1 == number) return false;

	// plasma6 allows us to delete desktops in the middle. Unfortunately, this
	// messes up pager, so we have to do what we did un plasma5 and shift all
	// windows by hand to delete the last desktop
	workspace.windowList().forEach((client) =>
	{
		shift_righter_than(client, number)
	});
	// remove last
	workspace.removeDesktop(workspace.desktops[workspace.desktops.length - 1]);
	return true;
}

// tells if desktop has no windows of its own
function is_empty_desktop(number)
{
	const desktop = workspace.desktops[number];
	log(`is_empty_desktop(${number})`)
	const cls = workspace.windowList();
	cls.forEach(client =>
	{
		// is client on desktop?
		if (client.desktops.indexOf(desktop) !== -1
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
	log(`desktop_changed_for() -> Client ${client.caption} just moved to desktop number ${client.desktops}`);

	const last_desktop = workspace.desktops[workspace.desktops.length - 1];
	if (client.desktops.indexOf(last_desktop) != -1)
	{
		add_desktop();
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
	const last_desktop = workspace.desktops[workspace.desktops.length - 1];
	if (client.desktops.indexOf(last_desktop) != -1)
	{
		add_desktop();
	}

	// subscribe the client to create desktops when desktop switched
	client.desktopsChanged.connect(() => { desktop_changed_for(client); });
}

/**
 * Deletes empty desktops to the right in case of a left switch
 */
function on_desktop_switch(old_desktop)
{
	log(`on_desktop_switch(${old_desktop})`);

	const old_desktop_index = workspace.desktops.indexOf(old_desktop);
	const current_desktop_index = workspace.desktops.indexOf(workspace.currentDesktop)

	// do nothing if we switched to the right
	if (old_desktop_index <= current_desktop_index) return;

	// start from next desktop to the right
	let desktop_idx = current_desktop_index + 1;

	// prevent infinite loop in case of an error - only try as many times as there are desktops.
	// Might save us if other plugins interfere with workspace creation/deletion
	let loop_counter = 0;
	const loop_limit = workspace.desktops.length;
	for (; desktop_idx < workspace.desktops.length && loop_counter < loop_limit; ++desktop_idx)
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
workspace.windowAdded.connect(on_client_added);
// also do this for all existing clients
workspace.windowList().forEach(on_client_added);

// handle change desktop events
workspace.currentDesktopChanged.connect((old_desktop) => { on_desktop_switch(old_desktop); });

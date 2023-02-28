const MIN_DESKTOPS = 2;
const LOOP_LIMIT = 100;

function add_desktop()
{
	print("add_desktop()");
	workspace.desktops++;
}

// shifts a window to the left if it's more to the right than number
function shift_righter_than(client, number)
{
	if (client.desktop > number) {
		print(`Shifting ${client.caption} to desktop ${client.desktop - 1}`);
		client.desktop--;
	}
}

/**
 * Delete a desktop by number
 * Returns true if desktop was deleted, false if wasn't
 * @returns true if removed
 */
function remove_desktop_with(number)
{
	print(`remove_desktop_with(${number})`);

	// don't do anything if below minimum desktops
	if (workspace.desktops <= MIN_DESKTOPS) return false;

	// do not remove empty desktop at the end
	if (workspace.desktops == number) return false;

	// Shift all clients right from desktop $number to the left
	// instead of deleting the desktop directly
	// Once shifted remove desktop with the highest number
	// This is less efficient than deleting directly,
	// BUT the workspace names do not get messed up over time
	workspace.clientList().forEach((client) => {
		shift_righter_than(client, number)
	});

	workspace.removeDesktop(workspace.desktops - 1);
	return true;
}

// tells if desktop has no windows of its own
function is_empty_desktop(number)
{
	print(`is_empty_desktop(${number})`)
	var cls = workspace.clientList();
	for (var i = 0; i < cls.length; ++i) {
		let client = cls[i];
		// is client on desktop?
		if (client.x11DesktopIds.indexOf(number) !== -1 // works also in wayland...
			&& !client.skipPager // ignore hidden windows
			&& !client.onAllDesktops // ignore windows on all desktops
		) {
			print(`Desktop ${number} not empty because ${client.caption} is there`);
			return false;
		}
	}

	return true;
}

/**
 * Checks for new created or moved windows if they are occupying the last desktop
 * -> if yes, create new one to the right
 */
function desktop_changed_for(client)
{
	print(`desktop_changed_for() -> Client ${client.caption} just moved to desktop number ${client.desktop}`);

	if (client.desktop >= workspace.desktops) {
		add_desktop();
	}
}

/**
 * When creating new windows, check whether they are occupying the last desktop
 */
function on_client_added(client)
{
	if (client === null) {
		// just in case
		return;
	}

	if (client.skipPager) {
		//ignore hidden windows
		return;
	}

	// add a new desktop for a client too right
	if (client.desktop >= workspace.desktops) {
		add_desktop();
	}

	// subscribe the client to create desktops when desktop switched
	client.desktopChanged.connect(() => { desktop_changed_for(client); });
}

/**
 * Deletes empty desktops to the right in case of a left switch
 */
function on_desktop_switch(old_desktop)
{
	print(`on_desktop_switch(${old_desktop})`);

	// do nothing if we switched to the right
	if (old_desktop <= workspace.currentDesktop) return;

	// start from next desktop to the right
	let desktop = workspace.currentDesktop + 1;

	// prevent infinit loop in case of an error
	// might happen if other plugins interfere with workspace creation/deletion
	let safety = 0;
	for (; desktop < workspace.desktops && safety < LOOP_LIMIT; desktop++) {
		safety++;
		if (is_empty_desktop(desktop) && remove_desktop_with(desktop)) {
			// we removed a desktop so we need to reduce our counter also
			desktop--;
		}
	}
}


/*****  Main part *****/

// actions relating to creating desktops
// also this subscribes all clients to their desktopChanged event
workspace.clientAdded.connect(on_client_added);
// also do this for all existing clients
workspace.clientList().forEach(on_client_added);

// handle change desktop events
workspace.currentDesktopChanged.connect((old_desktop) => { on_desktop_switch(old_desktop); });

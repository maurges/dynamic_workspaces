function add_desktop()
{
	workspace.desktops += 1;
}

// shifts a window to the left if it's more to the right than number
function shift_righter_than(number)
{
	return function(client)
	{
		if (client.desktop > number) {
			client.desktop -= 1;
		}
	}
}

// deletes last desktop without fanfare
function delete_last()
{
	// don't do anything if last two remain
	if (workspace.desktops <= 2)  return;
	workspace.desktops -= 1;
}

// simulates deletion of desktop in the middle
// Returns true if desktop was deleted, false if wasn't
function delete_desktop(number)
{
	print("delete desktop " + number);
	// don't do anything for last desktop
	if (workspace.desktops == 1)  return false;
	if (workspace.desktops == number)  return false;

	if (workspace.desktops == 2) {
		// don't delete, only shift left
		workspace.clientList().forEach(shift_righter_than(number));
		return false;
	}

	if (number >= workspace.desktops - 1) {
		// delete without shifting
		delete_last();
		return true;
	}

	delete_last();
	workspace.clientList().forEach(shift_righter_than(number));
	return true;
}

// tells if desktop has no windows of its own
function is_empty_desktop(number)
{
	var cls = workspace.clientList();
	for (var i = 0; i < cls.length; ++i) {
		if (cls[i].desktop == number
			&& !cls[i].skipPager // don't count hidden windows
		) {
			print("Not empty: " + cls[i].caption + " is there");
			return false;
		}
	}
	return true;
}

function is_last_empty()
{
	// -1 as we always have the last desktop that we keep empty for moving
	// things to it
	return is_empty_desktop(workspace.desktops - 1);
}

function delete_empty_last()
{
	if (is_last_empty()) {
		delete_last();
		print("deleted last desktop");
	}
}

function desktop_changed_for(client)
{
	return function() {
		var message = "Client " + client.caption + " just moved";
		message += "\n to desktop number " + client.desktop;
		message += " out of " + workspace.desktops;

		if (client.desktop >= workspace.desktops) {
			add_desktop();
			message += "\nadded a desktop";
		}
		else {
			delete_empty_last();
		}

		print(message);
	}
}


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
	client.desktopChanged.connect(desktop_changed_for(client))
}

function on_desktop_changed(old_desktop, client)
{
	// delete empty desktops that we swithced from

	if (old_desktop !== workspace.desktops && is_empty_desktop(old_desktop)) {
		// delete desktop
		// only delete desktop if doing so would be unnoticeable
		if (old_desktop > workspace.currentDesktop) {
			delete_desktop(old_desktop);
		}
	} else if (workspace.currentDesktop === 1) {
		// delete all empty desktops to the right if we switched to first
		for (var i = 1; i < workspace.desktops; ++i) {
			if (is_empty_desktop(i)) {
				var deleted = delete_desktop(i);
				if (deleted) {
					i -= 1;
				}
			}
		}
	}
}


/*****  Main part *****/

// actions relating to creating desktops
// also this subscribes all clients to their desktopChanged event
workspace.clientAdded.connect(on_client_added);
// also do this for all existing clients
workspace.clientList().forEach(on_client_added);

// actions relating to deleting desktops
workspace.currentDesktopChanged.connect(on_desktop_changed);

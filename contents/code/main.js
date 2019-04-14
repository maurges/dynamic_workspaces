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
function delete_desktop(number)
{
	// don't do anything for last desktop
	if (workspace.desktops == 1)  return;

	if (workspace.desktops == 2) {
		// don't delete, only shift left
		workspace.clientList().forEach(shift_righter_than(number));
		return;
	}

	if (number >= workspace.desktops - 1) {
		// actually perform deletion
		delete_last();
		return;
	}

	// shift all windows and the last desktop will delete itself as per
	// case above triggered by connections on desktopChanged
	workspace.clientList().forEach(shift_righter_than(number));
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
	return function()
	{
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


function subscribe(client)
{
	if (client.skipPager) {
		// don't subscribe to hidden windows
		return;
	}

	// add a new desktop for a client too right
	if (client.desktop >= workspace.desktops) {
		add_desktop();
	}

	print("Connected to " + client.caption + " on workspace " + client.desktop);
	client.desktopChanged.connect(desktop_changed_for(client));
}


/*****  Main part *****/

workspace.clientAdded.connect(subscribe);
// also subscribe all existing clients
workspace.clientList().forEach(subscribe);

// create an empty desktop to the right if doesn't exist
if (workspace.desktops < 2 || !is_last_empty()) {
	add_desktop();
}

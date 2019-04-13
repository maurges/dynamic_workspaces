// tells if desktop with the number only has one client
function has_one_window(number, client)
{
	// as this is used for determining whether to delete the desktop, return
	// false for first
	if (number == 1)  return false;

	var cls = workspace.clientList();
	for (var i = 0; i < cls.length; ++i) {
		if (cls[i].desktop == number && cls[i] != client) {
			print("Not empty: " + cls[i].caption + " is there");
			return false;
		}
	}
	return true;
}

function is_empty_desktop(number) { return has_one_window(number, null) }

function is_last_empty()
{
	// -1 as we always have the last desktop that we keep empty for moving
	// things to it
	return is_empty_desktop(workspace.desktops - 1);
}

function last_has_one(client)
{
	return has_one_window(workspace.desktop - 1, client);
}

function add_desktop()
{
	workspace.desktops += 1;
}

function delete_desktop()
{
	if (workspace.desktops <= 2)  {print("didn't delete actually");return;}
	workspace.desktops -= 1;
}

function delete_empty_last()
{
	if (is_last_empty()) {
		delete_desktop();
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

function window_closed(client)
{
	if (last_has_one(client)) {
		delete_desktop();
		// switch to previous desktop as this is empty now
		workspace.currentDesktop -= 1;
	}
}

function subscribe(client)
{
	print("Connected to " + client.caption);
	client.desktopChanged.connect(desktop_changed_for(client));
}


/*****  Main part *****/

workspace.clientAdded.connect(subscribe);
workspace.clientRemoved.connect(window_closed);

// also subscribe all existing clients
var clients = workspace.clientList();
for (var i = 0; i < clients.length; ++i){
	subscribe(clients[i]);
}

// create an empty desktop to the right if doesn't exist
if (workspace.desktops < 2 || !is_last_empty()) {
	add_desktop();
}

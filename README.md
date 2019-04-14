# Dynamic Workspaces

A kwin script that creates and deletes desktops as you move windows on the last one.

I intented to replicate some of gnome-desktop's behavior with moving windows around.
As this is a simple script for satisfying my needs,
it only workds horizontally left-toright.
What I did is this:

- There is always an empty desktop on the right
- When you move a window to that desktop, a new desktop is created
- When you move window away from last desktop, or close the window,
  the desktop is destroyed

## Installation

``` bash
git clone https://github.com/d86leader/dynamic_workspaces.git
cd dynamic_workspaces
plasmapkg2 --type kwinscript -i .
```

Then you might need to restart kwin. Do this by either logging out and back in, or by running `kwin_x11 --replace` in krunner.

### Upgrade

If updating, change the `plasmapkg2` command above to the following:

``` bash
plasmapkg2 --type kwinscript -u .
```

## Known issues

This script doesn't live well with other scripts that create workspaces.
Mix at your own risk!
If you find a compatibility issue you can fix, fix it and make a merge request. (-:

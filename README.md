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

Version 3.1 tested on Plasma versions from 5.27 to 6.2.5. For versions tested
since 5.6, see releases `1.*`, latest found
[here](https://github.com/d86leader/dynamic_workspaces/releases/tag/v1.0.1)

## Installation

On plasma 6:

``` bash
git clone https://github.com/d86leader/dynamic_workspaces.git
cd dynamic_workspaces
kpackagetool6 --type KWin/Script --install .
```

On plasma 5, instead of the last line:

```sh
plasmapkg2 --type kwinscript -i .
```

Then you might need to restart kwin. Do this by either logging out and back in, or by running `kwin_wayland --replace` in krunner.

### Upgrade

If updating, change the `plasmapkg2`/`kpackagetool6` command above to the following:

``` bash
# plasma 6
kpackagetool6 --type KWin/Script --upgrade .
# plasma 5
plasmapkg2 --type kwinscript -u .
```

## Known issues

This script doesn't live well with other scripts that create workspaces.
Mix at your own risk!

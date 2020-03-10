# raspberry-ap

A Node application which makes connecting your RaspberryPi to your home wifi easier.

Tested on Stretch and Raspberrt Pi 3

## RPI 4 Note:

I realize that a bunch of folks will try this out using the shiny new RaspberryPi v4. I caution you that this is not something I have tried, I believe this was tested on a Pi3 to success. However, if you find that this works on a Pi4, please let me know and I will adjust the readme accordingly. If it does not work, it is probably a few PRs away from success :)

## Why?

When unable to connect to a wifi network, this service will turn the RPI into a wireless AP. This allows us to connect to it via a phone or other device and configure our home wifi network (for example).

Once configured, it prompts the PI to reboot with the appropriate wifi credentials. If this process fails, it immediately re-enables the PI as an AP which can be configurable again.

This project broadly follows these [instructions](https://www.raspberrypi.org/documentation/configuration/wireless/access-point.md) in setting up a RaspberryPi as a wireless AP.

## Requirements

The NodeJS modules required are pretty much just `underscore`, `async`, and `express`. 

The web application requires `angular` and `font-awesome` to render correctly. To make the deployment of this easy, one of the other requirements is `bower`.

If you do not have `bower` installed already, you can install it globally by running: `sudo npm install bower -g`.

## Install

```sh
$cd raspberry-ap
$npm update
$bower install
$sudo npm run-script provision
$sudo npm start
```


## Setup the app as a service

There is a startup script included to make the server starting and stopping easier. Do remember that the application is assumed to be installed under `/home/pi/raspberry-ap`. Feel free to change this in the `assets/init.d/raspberry-ap` file.

```sh
$sudo cp assets/init.d/raspberry-ap /etc/init.d/raspberry-ap 
$sudo chmod +x /etc/init.d/raspberry-ap  
$sudo sudo systemctl enable autohotspot.service
```

```sh
$sudo cp assets/service/raspberry-ap.service /lib/systemd/system/raspberry-ap.service
$sudo cp assets/service/raspberry-ap.service /usr/lib/systemd/system/raspberry-ap.service
$sudo chmod +x /usr/lib/systemd/system/raspberry-ap.service
$sudo chmod +x /lib/systemd/system/raspberry-ap.service
$sudo systemctl daemon-reload
$sudo systemctl enable autohotspot.service
```

### Gotchas

#### `hostapd`

The `hostapd` application does not like to behave itself on some wifi adapters (RTL8192CU et al). This link does a good job explaining the issue and the remedy: [Edimax Wifi Issues](http://willhaley.com/blog/raspberry-pi-hotspot-ew7811un-rtl8188cus/). The gist of what you need to do is as follows:

```
# run iw to detect if you have a rtl871xdrv or nl80211 driver
$iw list
```

If the above says `nl80211 not found.` it means you are running the `rtl871xdrv` driver and probably need to update the `hostapd` binary as follows:
```
$cd raspberry-ap
$sudo mv /usr/sbin/hostapd /usr/sbin/hostapd.OLD
$sudo mv assets/bin/hostapd.rtl871xdrv /usr/sbin/hostapd
$sudo chmod 755 /usr/sbin/hostapd
```

Note that the `wifi_driver_type` config variable is defaulted to the `nl80211` driver. However, if `iw list` fails on the app startup, it will automatically set the driver type of `rtl871xdrv`. Remember that even though you do not need to update the config / default value - you will need to use the updated `hostapd` binary bundled with this app.

#### `dhcpcd` 

Latest versions of raspbian use dhcpcd to manage network interfaces, since we are running our own dhcp server, if you have dhcpcd installed - make sure you deny the wifi interface as described in the installation section. 

TODO: Handle this automatically.

## Usage

This is approximately what occurs when we run this app:

1. Check to see if we are connected to a wifi AP
2. If connected to a wifi, do nothing -> exit
3. (if not wifi, then) Convert RPI to act as an AP (with a configurable SSID)
4. Host a lightweight HTTP server which allows for the user to connect and configure the RPIs wifi connection. The interfaces exposed are RESTy so other applications can similarly implement their own UIs around the data returned.
5. Once the RPI is successfully configured, reset it to act as a wifi device (not AP anymore), and setup it's wifi network based on what the user selected.
6. At this stage, the RPI is named, and has a valid wifi connection which it is now bound to.

Typically, I have the following line in my `/etc/rc.local` file:
```
cd /home/pi/raspberry-ap
sudo /usr/bin/node server.js
```

Note that this is run in a blocking fashion, in that this script will have to exit before we can proceed with others defined in `rc.local`. This way I can guarantee that other services which might rely on wifi will have said connection before being run. If this is not the case for you, and you just want this to run (if needed) in the background, then you can do:

```
cd /home/pi/raspberry-ap
sudo /usr/bin/node server.js < /dev/null &
```

## User Interface

In my config file, I have set up the static ip for my PI when in AP mode to `192.168.44.1` and the AP's broadcast SSID to `rpi-config-ap`. These are images captured from my osx dev box.

Step 1: Power on Pi which runs this app on startup (assume it is not configured for a wifi connection). Once it boots up, you will see `rpi-config-ap` among the wifi connections.  The password is configured in config.json.

<img src="https://raw.githubusercontent.com/sabhiram/public-images/master/raspberry-ap/wifi_options.png" width="200px" height="160px" />

Step 2: Join the above network, and navigate to the static IP and port we set in config.json (`http://192.168.44.1:88`), you will see:

<img src="https://raw.githubusercontent.com/sabhiram/public-images/master/raspberry-ap/ui.png" width="404px" height="222px" />

Step 3: Select your home (or whatever) network, punch in the wifi passcode if any, and click `Submit`. You are done! Your Pi is now on your home wifi!!

## Testing


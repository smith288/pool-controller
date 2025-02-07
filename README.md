# Pool Controller

This project utilizes the Hayward AquaLogic/ProLogic RS485 communication bus to read the frames sent across and then will allow for manipulation of the pool equipment.  This saved me upwards of $4,500 so I don't have to use the OmniLogic upgrade system.

![image](docs/Screenshot.png)

# Components

Elfin EW11 RS485-Wifi module - http://www.hi-flying.com/elfin-ew10-elfin-ew11
![image](http://www.hi-flying.com/image/cache/catalog/%E5%B0%8F%E7%B2%BE%E7%81%B5%E7%B3%BB%E5%88%97/1533453808(1)-458x458.jpg)

AquaLogic Board
![Screenshot 2025-02-04 at 10 26 26 PM](https://github.com/user-attachments/assets/2badf1e1-9417-4814-8d92-42aabd524898)

![Screenshot 2025-02-04 at 10 27 01 PM](https://github.com/user-attachments/assets/8b70f7ab-7a50-4aa6-bafb-671a1a3764a2)

Note: Check documentation for your version of the EW11 as it might not be the same as the ones above.


EW11 Script
![Script](docs/EW11.txt)

[IOTService Program](http://ftp.hi-flying.com:9000/IOTService/) - To edit the EW11 - SLOW download

Configuration Setup

*	Install the IoTService app on a Windows PC with WiFi access
*	Connect PC WiFi to the EW11 WiFi SSID: EW11_???? (open)
*	Run IOTService app, the device should be found automatically
    * If no device is shown, then the EW11 is not connected to WiFi
    *	The default IP address when in AP mode is: 10.10.100.254
    *	Connection can also be made with web browser

*	Double click device or single click Config, then click Edit on the Device Status window

![image](https://github.com/user-attachments/assets/a4a3b5b1-146d-4c6e-a852-8e3ef3d7884a)

![image](https://github.com/user-attachments/assets/f918eb40-188f-4a37-8a7c-18e022008f64)

![image](https://github.com/user-attachments/assets/97e3a153-2f97-45f4-8246-0e9e92551f8d)

*	Setup UART/Socket/WiFI sections as shown above
*	Change WiFI mode to “STA”
*	Enter your own local WiFi SSID and Key in the STA entry
*	Optional, change DNS server under System
*	Confirm Settings and determine new EW11 IP address from IOTService
*	Use Export to save a copy of all the settings in case the EW11 settings get wiped. Import will reload all settings.

**Script Load**

*	Connect PC to local area network
*	Run IOTService app, the device should be found automatically
*	Double click device, then click Edit
*	Click on Detail
*	IMPORTANT: Set Gap Time to 10 under UART
*	Click on Edit Script
*	Click on Import Script
*	Download the script (docs/EW11.txt):
*	Select Script, then Confirm

![image](https://github.com/user-attachments/assets/26de3113-b0d1-4adb-bd51-75daf0ff7682)

![image](https://github.com/user-attachments/assets/a310ad1f-bd76-4e0d-a37a-fbfe78fd45da)

[![Watch this video of the hardware setup](https://img.youtube.com/vi/gO161h5k5Hg/1.jpg)](https://youtube.com/shorts/gO161h5k5Hg)

Special thanks to [@swilson](https://github.com/swilson) and [@mas985](https://github.com/mas985) for their fantastic research and code they've made available.


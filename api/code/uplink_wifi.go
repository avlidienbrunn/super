/*
Routines for managing the uplink interfaces, for outbound internet
*/
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"text/template"
)

//wpa_supplicant -B -i ${iface} -Dnl80211 -c /configs/wifi_uplink/wpa_${iface}.conf

var WpaConfigPath = TEST_PREFIX + "/configs/wifi_uplink/wpa.json"

var WPAmtx sync.Mutex

type WPANetwork struct {
	Disabled bool
	Password string
	SSID     string
	Priority string `json:"omitempty"`
	BSSID    string `json:"omitempty"`
}

type WPAIface struct {
	Iface    string
	Networks []WPANetwork
}

type WPASupplicantConfig struct {
	WPAs []WPAIface
}

func (n *WPANetwork) Validate() error {
	// Check for newlines in Password field
	if strings.Contains(n.Password, "\n") {
		return fmt.Errorf("Password field contains newline characters")
	}

	// Check for newlines in SSID field
	if strings.Contains(n.SSID, "\n") {
		return fmt.Errorf("SSID field contains newline characters")
	}

	if n.Priority != "" {
		_, err := strconv.Atoi(n.Priority)
		if err != nil {
			return fmt.Errorf("Priority field must contain numeric value")
		}
	}

	if n.BSSID != "" {
		// Check if BSSID field is a valid MAC address
		match, err := regexp.MatchString("^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$", n.BSSID)
		if err != nil || !match {
			return fmt.Errorf("BSSID field must be a valid MAC address")
		}
	}

	return nil
}

func writeWPAs(config WPASupplicantConfig) {
	//assumes lock is held

	for _, wpa := range config.WPAs {
		for _, network := range wpa.Networks {
			tmpl, err := template.New("wpa_supplicant.conf").Parse(`ctrl_interface=DIR=/var/run/wpa_supplicant/` + wpa.Iface + `
        {{range .Networks}}
        {{if not .Disabled}}
        network={
        	ssid="{{.SSID}}"
        	psk="{{.Password}}"
        	{{if .Priority}}priority={{.Priority}}{{end}}
        	{{if .BSSID}}bssid={{.BSSID}}{{end}}
        }
        {{end}}
        {{end}}`)

			if err != nil {
				log.Println("Error parsing template:", err)
				return
			}

			var result bytes.Buffer
			err = tmpl.Execute(&result, network)
			if err != nil {
				fmt.Println("Error executing template:", err)
				return
			}
			fp := TEST_PREFIX + "/configs/wifi_uplink/wpa_" + wpa.Iface + ".conf"
			ioutil.WriteFile(fp, result.Bytes(), 0600)
		}
	}
}

func loadWpaConfig() (error, WPASupplicantConfig) {
	config := WPASupplicantConfig{}

	WPAmtx.Lock()
	defer WPAmtx.Unlock()

	data, err := ioutil.ReadFile(WpaConfigPath)
	if err != nil {
		log.Println(err)
		return err, config
	} else {
		err = json.Unmarshal(data, &config)
		if err != nil {
			log.Println(err)
			return err, config
		}
	}
	return nil, config
}

func saveWpaConfig(config WPASupplicantConfig) {
	WPAmtx.Lock()
	defer WPAmtx.Unlock()

	file, _ := json.MarshalIndent(config, "", " ")
	err := ioutil.WriteFile(WpaConfigPath, file, 0600)
	if err != nil {
		log.Println(err)
	}

	writeWPAs(config)
}

func getWpaSupplicantConfig(w http.ResponseWriter, r *http.Request) {
	err, config := loadWpaConfig()
	if err != nil {
		http.Error(w, "Failed to load wpa configuration", 400)
		return
	}
	json.NewEncoder(w).Encode(config)
}

func updateWpaSupplicantConfig(w http.ResponseWriter, r *http.Request) {
	config := WPASupplicantConfig{}
	err := json.NewDecoder(r.Body).Decode(&config)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	enabled := false

	for _, wpa := range config.WPAs {
		pattern := `^[a-zA-Z]+[0-9]*(\.[a-zA-Z]+[0-9]*)*$`
		matched, err := regexp.MatchString(pattern, wpa.Iface)
		if err != nil || !matched {
			log.Println("Invalid iface name", err)
			http.Error(w, "Invalid iface name", 400)
			return
		}

		for _, network := range wpa.Networks {

			//track whether at least one network is enabled.
			if !enabled {
				if network.Disabled == false {
					enabled = true
				}
			}

			err := network.Validate()
			if err != nil {
				log.Println("Validation error:", err)
				http.Error(w, "Failed to validate network "+err.Error(), 400)
				return
			}
		}
	}

	saveWpaConfig(config)

	uplink_plugin := "WIFI-UPLINK"

	started := false
	if enabled {
		// at least one network is on, so ensure that the plugin is on
		started = enablePlugin(uplink_plugin)
	}

	//even if all were disabled, make sure to restart to reflect that.
	if !started {
		//restart the service if
		restartPlugin(uplink_plugin)
	}
}

func restartWpaClients(w http.ResponseWriter, r *http.Request) {
	uplink_plugin := "WIFI-UPLINK"
	restartPlugin(uplink_plugin)
}
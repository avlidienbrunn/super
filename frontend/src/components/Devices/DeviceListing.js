import React, { useContext, useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'
import { deviceAPI, wifiAPI, meshAPI } from 'api'
import APIWifi from 'api/Wifi'
import { useNavigate } from 'react-router-dom'
import Device from 'components/Devices/Device'
import { AlertContext } from 'layouts/Admin'
import { AppContext } from 'AppContext'
import Icon, { FontAwesomeIcon } from 'FontAwesomeUtils'
import {
  faCirclePlus,
  faEllipsis,
  //faFilter,
  faPlus,
  faTimes
} from '@fortawesome/free-solid-svg-icons'

import {
  Button,
  Box,
  Fab,
  Heading,
  HStack,
  VStack,
  Pressable,
  Text,
  View,
  useColorModeValue
} from 'native-base'
import { FlashList } from '@shopify/flash-list'
import { SwipeListView } from 'components/SwipeListView'

const DeviceListing = (props) => {
  const context = useContext(AlertContext)
  const appContext = useContext(AppContext)

  const [devices, setDevices] = useState(null)
  const navigate = useNavigate()
  const [groups, setGroups] = useState(['wan', 'dns', 'lan'])
  const [tags, setTags] = useState([])

  const sortDevices = (a, b) => {
    return (
      parseInt(
        parseInt(+b.isConnected || 0) * 1000 +
          a.RecentIP.replace(/[^0-9]+/g, '')
      ) -
      parseInt(
        parseInt(+a.isConnected || 0) * 1000 +
          b.RecentIP.replace(/[^0-9]+/g, '')
      )
    )
  }

  const refreshDevices = () => {
    deviceAPI
      .list()
      .then((devices) => {
        if (!devices) {
          return
        }

        let macs = Object.keys(devices).filter((id) => id.includes(':'))

        devices = Object.values(devices)
        setDevices(devices.sort(sortDevices))

        // set device oui if avail
        deviceAPI
          .ouis(macs)
          .then((ouis) => {
            let devs = devices.map((d) => {
              let oui = ouis.find((o) => o.MAC == d.MAC)
              d.oui = oui ? oui.Vendor : ''
              return d
            })

            setDevices(devs.sort(sortDevices))
          })
          .catch((err) => {})

        setGroups([...new Set(devices.map((device) => device.Groups).flat())])
        setTags([...new Set(devices.map((device) => device.DeviceTags).flat())])
        // TODO check wg status for virt
        if (!appContext.isWifiDisabled) {
          //for each interface
          wifiAPI.interfacesConfiguration().then((config) => {
            config
              .filter((iface) => iface.Type == 'AP' && iface.Enabled == true)
              .forEach((iface) => {
                wifiAPI
                  .allStations(iface.Name)
                  .then((stations) => {
                    let connectedMACs = Object.keys(stations)

                    let devs = devices.map((dev) => {
                      if (dev.isConnected !== true) {
                        dev.isConnected = connectedMACs.includes(dev.MAC)
                      }

                      return dev
                    })

                    devs.sort(sortDevices)

                    setDevices(devs)
                  })
                  .catch((err) => {
                    //context.error('WIFI API Failure', err)
                  })
              })
          })

          meshAPI
            .meshIter(() => new APIWifi())
            .then((r) =>
              r.forEach((remoteWifiApi) => {
                remoteWifiApi.interfacesConfiguration
                  .call(remoteWifiApi)
                  .then((config) => {
                    config
                      .filter(
                        (iface) => iface.Type == 'AP' && iface.Enabled == true
                      )
                      .forEach((iface) => {
                        remoteWifiApi.allStations
                          .call(remoteWifiApi, iface.Name)
                          .then((stations) => {
                            let connectedMACs = Object.keys(stations)
                            setDevices(
                              devices.map((dev) => {
                                if (dev.isConnected !== true) {
                                  dev.isConnected = connectedMACs.includes(
                                    dev.MAC
                                  )
                                }

                                return dev
                              })
                            )
                          })
                          .catch((err) => {
                            context.error(
                              'WIFI API Failure ' +
                                remoteWifiApi.remoteURL +
                                ' ' +
                                iface.Name,
                              err
                            )
                          })
                      })
                  })
              })
            )
            .catch((err) => {})
        }
      })
      .catch((err) => {
        context.error('API Failure', err)
      })
  }

  useEffect(() => {
    refreshDevices()
  }, [])

  const handleRedirect = () => {
    if (appContext.isWifiDisabled) {
      navigate('/admin/wireguard')
    } else {
      navigate('/admin/add_device')
    }
  }

  const renderItem = ({ item }) => (
    <Device
      key={item.MAC || item.WGPubKey} //keyExtractor is recommended, however, this fixes a bug on react web
      device={item}
      showMenu={true}
      groups={groups}
      tags={tags}
      notifyChange={refreshDevices}
    />
  )

  const closeRow = (rowMap, rowKey) => {
    if (rowMap[rowKey]) {
      rowMap[rowKey].closeRow()
    }
  }

  const deleteRow = (rowMap, rowKey) => {
    closeRow(rowMap, rowKey)
    const newData = [...devices]
    const prevIndex = devices.findIndex(
      (item) => item.MAC === rowKey || item.WGPubKey == rowKey
    )
    newData.splice(prevIndex, 1)
    setDevices(newData)
    deviceAPI
      .deleteDevice(rowKey)
      .then(refreshDevices)
      .catch((error) =>
        context.error('[API] deleteDevice error: ' + error.message)
      )
  }

  const renderHiddenItem = (data, rowMap) => (
    <HStack flex={1} pl={2} mt={1} mb={1}>
      <Pressable
        w="70"
        ml="auto"
        cursor="pointer"
        bg="coolGray.200"
        justifyContent="center"
        onPress={() =>
          navigate(
            `/admin/devices/${
              data.item.MAC || encodeURIComponent(data.item.WGPubKey)
            }`
          )
        }
        _pressed={{
          opacity: 0.5
        }}
      >
        <VStack alignItems="center" space={2}>
          <Icon icon={faEllipsis} color="coolGray.800" />
          <Text fontSize="xs" fontWeight="medium" color="coolGray.800">
            Edit
          </Text>
        </VStack>
      </Pressable>
      <Pressable
        w="70"
        cursor="pointer"
        bg="red.500"
        justifyContent="center"
        onPress={() => deleteRow(rowMap, data.item.MAC || data.item.WGPubKey)}
        _pressed={{
          opacity: 0.5
        }}
      >
        <VStack alignItems="center" space={2}>
          <Icon icon={faTimes} color="white" />
          <Text color="white" fontSize="xs" fontWeight="medium">
            Delete
          </Text>
        </VStack>
      </Pressable>
    </HStack>
  )

  // TODO
  let navbarHeight = 64
  let h =
    Platform.OS == 'web'
      ? Dimensions.get('window').height - navbarHeight
      : '100%'

  return (
    <View h={h}>
      <HStack justifyContent="space-between">
        <Heading fontSize="md" alignSelf="center" p={4}>
          Devices
        </Heading>

        <HStack ml="auto">
          {/*<Button
            size="sm"
            variant="ghost"
            colorScheme="blueGray"
            leftIcon={<Icon icon={faFilter} />}
            onPress={() => {}}
          >
            Filter
          </Button>*/}
          <Button
            size="sm"
            variant="ghost"
            colorScheme="blueGray"
            leftIcon={<Icon icon={faCirclePlus} />}
            onPress={handleRedirect}
          >
            Add
          </Button>
        </HStack>
      </HStack>

      {Platform.OS == 'ios' ? (
        <SwipeListView
          data={devices}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          rightOpenValue={-140}
          style={{ marginBottom: 20 }}
        />
      ) : (
        <>
          <FlashList
            data={devices}
            renderItem={renderItem}
            estimatedItemSize={120}
          />

          {/* padding */}
          <Box display={{ base: 'none', md: 'flex' }} h={8}></Box>
        </>
      )}

      {devices !== null && !devices.length ? (
        <Box
          bg={useColorModeValue('backgroundCardLight', 'backgroundCardDark')}
        >
          <Text color="muted.500" p={4}>
            There are no devices configured yet
          </Text>
        </Box>
      ) : null}

      <Fab
        renderInPortal={false}
        shadow={2}
        size="sm"
        icon={<Icon color="white" icon={faPlus} />}
        onPress={handleRedirect}
        _bg={useColorModeValue('backgroundCardLight', 'backgroundCardDark')}
        bg="primary.500"
      />
    </View>
  )
}

export default DeviceListing

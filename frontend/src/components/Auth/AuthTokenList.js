import React, { useContext, useEffect, useRef, useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import { Icon, FontAwesomeIcon } from 'FontAwesomeUtils'
import {copy} from 'utils'
import {
  faCirclePlus,
  faCopy,
  faPlus,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import { format as timeAgo } from 'timeago.js'

import {
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
  Tooltip,
  View,
  VStack,
  useColorModeValue
} from 'native-base'

import { FlashList } from '@shopify/flash-list'

import { authAPI } from 'api'
import { AlertContext } from 'AppContext'
import ModalForm from 'components/ModalForm'
import AddAuthToken from 'components/Auth/AddAuthToken'

const AuthTokenList = (props) => {
  const context = useContext(AlertContext)
  const [status, setStatus] = useState('not configured')
  const [tokens, setTokens] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const refModal = useRef(null)

  useEffect(() => {
    refreshList()
  }, [])

  const deleteListItem = (row) => {
    authAPI
      .deleteToken(row.Token)
      .then((done) => {
        const newData = [...tokens]
        const prevIndex = tokens.findIndex((t) => t.Token === row.Token)
        newData.splice(prevIndex, 1)
        setTokens(newData)
      })
      .catch((err) => context.error('Auth Token API', err))
  }

  const handleAddToken = () => {}

  const tokenExpired = (expire) => {
    return expire > 0 && expire < parseInt(new Date().getTime() / 1e3)
  }

  const refreshList = () => {
    authAPI
      .tokens()
      .then((tokens) => {
        setTokens(tokens)
      })
      .catch((err) => context.error('Auth Token API', err))
  }

  const notifyChange = () => {
    refModal.current()
    refreshList()
  }

  const triggerAdd = (triggerProps) => {
    return (
      <Button
        {...triggerProps}
        marginLeft="auto"
        variant="ghost"
        colorScheme="blueGray"
      >
        Add Token
      </Button>
    )
  }

  const showClipboard = true //Platform.OS !== 'web' || navigator.clipboard

  return (
    <View h={'100%'}>
      <HStack justifyContent="space-between" alignItems="center" p={4}>
        <Heading fontSize="md">API Tokens</Heading>

        <Box alignSelf="center">
          <ModalForm
            title="Create new Auth Token"
            triggerText="Add Auth Token"
            modalRef={refModal}
          >
            <AddAuthToken notifyChange={notifyChange} />
          </ModalForm>
        </Box>
      </HStack>

      <FlashList
        data={tokens}
        estimatedItemSize={100}
        renderItem={({ item, index }) => (
          <Box
            bg="backgroundCardLight"
            borderBottomWidth={0}
            my={2}
            mx={4}
            p={4}
            rounded="md"
            shadow="md"
            borderColor="muted.200"
            _dark={{ bg: 'backgroundCardDark', borderColor: 'muted.600' }}
          >
            <HStack w="100%" space={3} alignItems="center">
              <Stack
                direction={{ base: 'column', md: 'row' }}
                flex={1}
                alignItems={{ md: 'center' }}
                justifyContent={'space-between'}
                space={4}
              >
                <Text>{item.Name || `Token#${index}`}</Text>
                <HStack alignItems="center" justifyItems="flex-end">
                    <Text isTruncated>Copy Token</Text>
                    <Tooltip label={item.Token} onPress={alert} >
                    <IconButton
                      variant="unstyled"
                      icon={<Icon size="4" icon={faCopy} color="muted.500" />}
                      display={showClipboard ? 'flex' : 'none'}
                      onPress={() => copy(item.Token)}
                    />
                    </Tooltip>
                  {item.ScopedPaths != null && item.ScopedPaths.length > 0 ? (
                    <Text isTruncated>{JSON.stringify(item.ScopedPaths)}</Text>
                  ) : (
                    <Text isTruncated></Text>
                  )}
                </HStack>
              </Stack>

              <HStack
                w={{ base: '3/6', md: '2/6' }}
                space={1}
                justifyContent="flex-end"
              >
                <Text color="muted.500">Expire</Text>
                <Text
                  color={
                    tokenExpired(item.Expire) ? 'warning.400' : 'muted.500'
                  }
                >
                  {item.Expire ? timeAgo(new Date(item.Expire * 1e3)) : 'Never'}
                </Text>
              </HStack>

              <IconButton
                alignSelf="center"
                size="sm"
                variant="ghost"
                colorScheme="secondary"
                icon={<Icon icon={faXmark} />}
                onPress={() => deleteListItem(item)}
              />
            </HStack>
          </Box>
        )}
        keyExtractor={(item) => item.Token}
      />

      <VStack>
        {tokens !== null && tokens.length === 0 ? (
          <Text alignSelf="center">There are no API tokens added yet</Text>
        ) : null}
      </VStack>
    </View>
  )
}

export default AuthTokenList

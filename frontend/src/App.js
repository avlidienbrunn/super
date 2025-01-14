import React from 'react'
import { NativeBaseProvider } from 'native-base'
import { SSRProvider } from '@react-aria/ssr'
import {
  NativeRouter as Router,
  Route,
  Routes,
  Navigate
} from 'react-router-native'
import AuthLayout from 'layouts/Auth'
import AdminLayout from 'layouts/Admin'
import { routesAuth, routesAdmin } from 'routes'
import { theme } from 'Theme'

export default function App() {
  return (
    <SSRProvider>
      <NativeBaseProvider theme={theme}>
        <Router>
          <Routes>
            <Route
              key="index"
              path="/"
              element={<Navigate to="/auth/login" />}
            />

            <Route key="auth" path="/auth" element={<AuthLayout />}>
              {routesAuth.map((r) => (
                <Route key={r.path} path={r.path} element={<r.element />} />
              ))}
            </Route>

            <Route key="admin" path="/admin" element={<AdminLayout />}>
              {routesAdmin.map((r) => (
                <Route key={r.path} path={r.path} element={<r.element />} />
              ))}
            </Route>
          </Routes>
        </Router>
      </NativeBaseProvider>
    </SSRProvider>
  )
}

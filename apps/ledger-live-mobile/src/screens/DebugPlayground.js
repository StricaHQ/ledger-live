// @flow

import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import { withDevice } from "@ledgerhq/live-common/lib/hw/deviceAccess";
import BleTransport from "@ledgerhq/hw-transport-react-native-ble";
import { from } from "rxjs";
import { useSelector } from "react-redux";
import NavigationScrollView from "../components/NavigationScrollView";
import { lastConnectedDeviceSelector } from "../reducers/settings";
import LText from "../components/LText";
import Button from "../components/Button";

export default function DebugPlayground() {
  const { colors } = useTheme();
  const lastConnectedDevice = useSelector(lastConnectedDeviceSelector);
  const urlUninstall =
    "wss://scriptrunner.api.live.ledger.com/update/install?" +
    "targetId=855638020" +
    "&perso=perso_11" +
    "&firmware=nanox%2F2.0.2-2%2Fbitcoin%2Fapp_2.0.4_del" +
    "&firmwareKey=nanox%2F2.0.2-2%2Fbitcoin%2Fapp_2.0.4_del_key" +
    "&hash=8bf06e39e785ba5a8cf27bfa95036ccab02d756f8b8f44c3c3137fd035d5cb0c" +
    "&livecommonversion=22.0.0";
  const urlInstall =
    "wss://scriptrunner.api.live.ledger.com/update/install?" +
    "targetId=855638020" +
    "&perso=perso_11" +
    "&firmware=nanox%2F2.0.2-2%2Fbitcoin%2Fapp_2.0.4" +
    "&firmwareKey=nanox%2F2.0.2-2%2Fbitcoin%2Fapp_2.0.4_key" +
    "&hash=8bf06e39e785ba5a8cf27bfa95036ccab02d756f8b8f44c3c3137fd035d5cb0c" +
    "&livecommonversion=22.0.0";

  const onInstall = useCallback(() => {
    (async function exchange() {
      await withDevice(lastConnectedDevice?.deviceId)(_ =>
        from([BleTransport.runner(urlInstall)]),
      ).toPromise();
    })();
  }, [lastConnectedDevice?.deviceId, urlInstall]);

  const onUninstall = useCallback(() => {
    (async function exchange() {
      await withDevice(lastConnectedDevice?.deviceId)(_ =>
        from([BleTransport.runner(urlUninstall)]),
      ).toPromise();
    })();
  }, [lastConnectedDevice?.deviceId, urlUninstall]);

  return (
    <NavigationScrollView>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LText tertiary>
          {
            "Convenience screen for testing purposes, please leave empty when commiting."
          }
        </LText>
        <Button
          mt={2}
          type={"primary"}
          event={""}
          onPress={onUninstall}
          title={"Uninstall"}
        />
        <Button
          mt={2}
          type={"primary"}
          event={""}
          onPress={onInstall}
          title={"Install"}
        />
      </View>
    </NavigationScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 16,
  },
});

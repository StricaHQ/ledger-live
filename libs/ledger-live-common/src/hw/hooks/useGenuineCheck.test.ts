/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { of, throwError } from "rxjs";
import {
  UserRefusedAllowManager,
  DisconnectedDeviceDuringOperation,
  UnresponsiveDeviceError,
} from "@ledgerhq/errors";
import { useGenuineCheck } from "./useGenuineCheck";
import {
  getGenuineCheckFromDeviceId,
  GetGenuineCheckFromDeviceIdResult,
} from "../getGenuineCheckFromDeviceId";

jest.mock("../getGenuineCheckFromDeviceId");
jest.useFakeTimers();

const mockedGetGenuineCheckFromDeviceId = jest.mocked(getGenuineCheckFromDeviceId);

describe("useGenuineCheck", () => {
  afterEach(() => {
    mockedGetGenuineCheckFromDeviceId.mockClear();
    jest.clearAllTimers();
  });

  describe("When the genuine check requests for a device permission", () => {
    it("should notify the hook consumer of the request", async () => {
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of({
          socketEvent: { type: "device-permission-requested" },
          lockedDevice: false,
        }),
      );
      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("requested");
      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeNull();
    });

    it("should notify the hook consumer if the device permission is granted", async () => {
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of({
          socketEvent: { type: "device-permission-granted" },
          lockedDevice: false,
        }),
      );
      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("granted");
      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeNull();
    });

    it("should notify the hook consumer if the device permission is refused", async () => {
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        throwError(() => new UserRefusedAllowManager()),
      );
      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("refused");
      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeNull();
    });
  });

  describe("When an error occurred during the genuine check", () => {
    it("should notify the hook consumer that an error occurred", async () => {
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        throwError(() => new DisconnectedDeviceDuringOperation()),
      );
      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeInstanceOf(DisconnectedDeviceDuringOperation);
    });
  });

  describe("When the genuine check is completed", () => {
    describe("and it is a success", () => {
      it("should notify the hook consumer of the success", async () => {
        mockedGetGenuineCheckFromDeviceId.mockReturnValue(
          of({
            socketEvent: { type: "result", payload: "0000" },
            lockedDevice: false,
          }),
        );
        const { result } = renderHook(() =>
          useGenuineCheck({
            getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
            deviceId: "A_DEVICE_ID",
          }),
        );

        await act(async () => {
          jest.advanceTimersByTime(1);
        });

        expect(result.current.genuineState).toEqual("genuine");
        expect(result.current.error).toBeNull();
      });
    });

    describe("and the device is not genuine", () => {
      it("should notify the hook consumer that the device is not genuine", async () => {
        mockedGetGenuineCheckFromDeviceId.mockReturnValue(
          of({
            socketEvent: { type: "result", payload: "1111" },
            lockedDevice: false,
          }),
        );
        const { result } = renderHook(() =>
          useGenuineCheck({
            getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
            deviceId: "A_DEVICE_ID",
          }),
        );

        await act(async () => {
          jest.advanceTimersByTime(1);
        });

        expect(result.current.genuineState).toEqual("non-genuine");
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe("When the hook consumer requests to reset the genuine check state", () => {
    it("should reset the device permission and genuine states", async () => {
      // In the case of an unsuccessful genuine check
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of(
          {
            socketEvent: { type: "device-permission-granted" },
            lockedDevice: false,
          } as GetGenuineCheckFromDeviceIdResult,
          {
            socketEvent: { type: "result", payload: "1111" },
            lockedDevice: false,
          } as GetGenuineCheckFromDeviceIdResult,
        ),
      );

      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          isHookEnabled: true,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("granted");
      expect(result.current.genuineState).toEqual("non-genuine");
      expect(result.current.error).toBeNull();

      // We ask to reset the genuine check state
      await act(async () => {
        result.current.resetGenuineCheckState();
      });

      expect(result.current.devicePermissionState).toEqual("unrequested");
      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeNull();
    });
  });

  describe("When the device is locked during the genuine check", () => {
    it("should notify the hook consumer of the need to unlock the device", async () => {
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of({
          socketEvent: null,
          lockedDevice: true,
        }),
      );

      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("unlock-needed");
      expect(result.current.genuineState).toEqual("unchecked");
      expect(result.current.error).toBeNull();
    });
  });

  describe("When device permission is requested but times out", () => {
    const mockedGetGenuineCheckFromDeviceId = jest.fn();
    const permissionTimeoutMs = 60 * 1000;

    it("should throw UnresponsiveDeviceError after 30 seconds if permission is not granted", async () => {
      // Given the getGenuineCheckFromDeviceId function will return a device permission request
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of({
          socketEvent: { type: "device-permission-requested" },
          lockedDevice: false,
        }),
      );

      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
          permissionTimeoutMs,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.devicePermissionState).toEqual("requested");
      expect(result.current.error).toBeNull();

      // When the permission times out
      await act(async () => {
        jest.advanceTimersByTime(permissionTimeoutMs + 1);
      });

      // Then the hook consumer should be notified of the error
      expect(result.current.error).toBeInstanceOf(UnresponsiveDeviceError);
      expect(result.current.devicePermissionState).toEqual("requested");
    });
  });

  describe("When device permission is granted", () => {
    const mockedGetGenuineCheckFromDeviceId = jest.fn();

    it("should not throw UnresponsiveDeviceError and set permission state to granted", async () => {
      // Given the getGenuineCheckFromDeviceId function will return a device permission granted
      mockedGetGenuineCheckFromDeviceId.mockReturnValue(
        of({
          socketEvent: { type: "device-permission-granted" },
          lockedDevice: false,
        }),
      );

      const { result } = renderHook(() =>
        useGenuineCheck({
          getGenuineCheckFromDeviceId: mockedGetGenuineCheckFromDeviceId,
          deviceId: "A_DEVICE_ID",
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(1);
      });

      // Then the hook consumer should not have errors and the permission state should be granted
      expect(result.current.devicePermissionState).toEqual("granted");
      expect(result.current.error).toBeNull();
    });
  });
});

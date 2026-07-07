"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import type { SignerRole } from "../lib/deliveryActors";
import {
  type DeliveryScanMode,
  type DeliveryTicket,
  findInventoryByDeliveryScan,
  recordDeliveryScan,
  saveDeliverySignature,
  saveTechLocationCheckIn,
  scanMatchesTicket,
  ticketScanProgress,
  updateDeliveryActors,
  updateDeliveryRouteEstimate,
  uploadDeliveryDamagePhotos,
} from "../lib/deliveryFulfillment";
import {
  buildBossDeliveryRuns,
  buildDeliveryExceptions,
  buildGoogleMapsRouteUrl,
  buildTechRouteTickets,
  buildTruckLoads,
  modeLabel,
} from "../lib/deliveryUtils";

type UseDeliveryFormStateOptions = {
  tickets: DeliveryTicket[];
  isAdmin: boolean;
  canUseDelivery: boolean;
};

export type UseDeliveryFormStateReturn = ReturnType<typeof useDeliveryFormState>;

export function useDeliveryFormState({
  tickets,
  isAdmin,
  canUseDelivery,
}: UseDeliveryFormStateOptions) {
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<DeliveryScanMode>("load");
  const [busy, setBusy] = useState(false);

  // Signature form state
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState<SignerRole>("Patient");
  const [signerRelationship, setSignerRelationship] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [refusalReason, setRefusalReason] = useState("");

  // Return condition form state
  const [returnCondition, setReturnCondition] = useState("returned_ready");
  const [returnNotes, setReturnNotes] = useState("");

  // Damage photo form state
  const [damagePhotoFiles, setDamagePhotoFiles] = useState<File[]>([]);
  const [damagePhotoNotes, setDamagePhotoNotes] = useState("");
  const [damagePhotoBusy, setDamagePhotoBusy] = useState(false);

  // Route form state
  const [etaMinutes, setEtaMinutes] = useState("");
  const [routeSequence, setRouteSequence] = useState("");
  const [routeStatus, setRouteStatus] = useState("planned");
  const [routeNotes, setRouteNotes] = useState("");

  // Location form state
  const [locationBusy, setLocationBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  // Derived data
  const activeTickets = useMemo(
    () => tickets.filter((ticket) => ticket.fulfillmentStatus !== "returned"),
    [tickets]
  );

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    activeTickets[0] ??
    tickets[0] ??
    null;

  const progress = selectedTicket
    ? ticketScanProgress(selectedTicket)
    : { required: 0, loaded: 0, delivered: 0, returned: 0 };

  const exceptions = useMemo(() => buildDeliveryExceptions(tickets), [tickets]);
  const truckLoads = useMemo(() => buildTruckLoads(tickets), [tickets]);
  const bossDeliveryRuns = useMemo(() => buildBossDeliveryRuns(tickets), [tickets]);

  const selectedTech =
    selectedTicket?.assignedTech || selectedTicket?.deliveryTechName || "";

  const routeTickets = useMemo(
    () => buildTechRouteTickets(tickets, selectedTech),
    [tickets, selectedTech]
  );

  const routeUrl = useMemo(
    () => buildGoogleMapsRouteUrl(routeTickets, currentLocation),
    [routeTickets, currentLocation]
  );

  // Sync route form fields when selected ticket changes
  const selectedTicketKey = selectedTicket?.id ?? "";
  const selectedTicketEtaMinutes = selectedTicket?.etaMinutes ?? 0;
  const selectedTicketRouteSequence = selectedTicket?.routeSequence ?? 0;
  const selectedTicketRouteStatus = selectedTicket?.routeStatus ?? "";
  const selectedTicketRouteNotes = selectedTicket?.routeNotes ?? "";

  useEffect(() => {
    if (!selectedTicketKey) return;

    setEtaMinutes(selectedTicketEtaMinutes ? String(selectedTicketEtaMinutes) : "");
    setRouteSequence(selectedTicketRouteSequence ? String(selectedTicketRouteSequence) : "");
    setRouteStatus(selectedTicketRouteStatus || "planned");
    setRouteNotes(selectedTicketRouteNotes);
  }, [
    selectedTicketKey,
    selectedTicketEtaMinutes,
    selectedTicketRouteSequence,
    selectedTicketRouteStatus,
    selectedTicketRouteNotes,
  ]);

  // Handlers
  const openScanner = useCallback((mode: DeliveryScanMode) => {
    setScanMode(mode);
    setScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
  }, []);

  const handleScan = useCallback(
    async (code: string) => {
      if (!selectedTicket) {
        toast.error("Select a delivery ticket first.");
        return;
      }

      if (!canUseDelivery) {
        toast.error("You do not have permission to scan deliveries.");
        return;
      }

      setBusy(true);

      try {
        const inventoryItem = await findInventoryByDeliveryScan(code);

        if (!inventoryItem) {
          toast.error("No inventory item found for that scan.");
          return;
        }

        if (!scanMatchesTicket(selectedTicket, inventoryItem)) {
          toast.error("Scanned item does not match this delivery ticket.");
          return;
        }

        await recordDeliveryScan({
          ticket: selectedTicket,
          inventoryItem,
          mode: scanMode,
          rawCode: code,
          returnCondition: scanMode === "return" ? returnCondition : undefined,
          returnNotes: scanMode === "return" ? returnNotes : undefined,
        });

        toast.success(
          `${inventoryItem.name} ${modeLabel(scanMode).toLowerCase()} recorded.`
        );
      } catch (error) {
        console.error("DELIVERY SCAN ERROR:", error);
        toast.error(
          error instanceof Error ? error.message : "Delivery scan failed."
        );
      } finally {
        setBusy(false);
      }
    },
    [selectedTicket, canUseDelivery, scanMode, returnCondition, returnNotes]
  );

  const handleActorChange = useCallback(
    async (field: "importedBy" | "receivedBy" | "assignedTech", value: string) => {
      if (!selectedTicket) return;

      try {
        await updateDeliveryActors(selectedTicket.id, {
          [field]: value,
        });
        toast.success("Delivery actor updated.");
      } catch (error) {
        console.error("DELIVERY ACTOR UPDATE ERROR:", error);
        toast.error("Could not update delivery actor.");
      }
    },
    [selectedTicket]
  );

  const handleSaveSignature = useCallback(async () => {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    if (!signatureDataUrl) {
      toast.error("Capture a signature first.");
      return;
    }

    if (!signerName.trim()) {
      toast.error("Enter signer name.");
      return;
    }

    setBusy(true);

    try {
      await saveDeliverySignature({
        ticket: selectedTicket,
        signerName,
        signerRole,
        signatureDataUrl,
        signerRelationship,
        witnessName,
        refusalReason,
      });

      setSignatureDataUrl("");
      setSignerName("");
      setSignerRole("Patient");
      setSignerRelationship("");
      setWitnessName("");
      setRefusalReason("");
      toast.success("Electronic delivery signature saved.");
    } catch (error) {
      console.error("DELIVERY SIGNATURE ERROR:", error);
      toast.error(
        error instanceof Error ? error.message : "Signature save failed."
      );
    } finally {
      setBusy(false);
    }
  }, [
    selectedTicket,
    signatureDataUrl,
    signerName,
    signerRole,
    signerRelationship,
    witnessName,
    refusalReason,
  ]);

  const handleDamagePhotoSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []).filter((file) =>
        file.type.startsWith("image/")
      );

      setDamagePhotoFiles((current) => [...current, ...selectedFiles].slice(0, 12));
      event.target.value = "";
    },
    []
  );

  const removeDamagePhoto = useCallback((index: number) => {
    setDamagePhotoFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }, []);

  const handleUploadDamagePhotos = useCallback(async () => {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    if (damagePhotoFiles.length === 0) {
      toast.error("Choose at least one damage photo.");
      return;
    }

    setDamagePhotoBusy(true);

    try {
      await uploadDeliveryDamagePhotos({
        ticket: selectedTicket,
        files: damagePhotoFiles,
        damageNotes: damagePhotoNotes,
        returnCondition,
      });

      setDamagePhotoFiles([]);
      setDamagePhotoNotes("");
      toast.success("Damage photos saved to the patient chart.");
    } catch (error) {
      console.error("DAMAGE PHOTO UPLOAD ERROR:", error);
      toast.error(
        error instanceof Error ? error.message : "Damage photo upload failed."
      );
    } finally {
      setDamagePhotoBusy(false);
    }
  }, [selectedTicket, damagePhotoFiles, damagePhotoNotes, returnCondition]);

  const handleSaveRouteEstimate = useCallback(async () => {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    try {
      await updateDeliveryRouteEstimate({
        ticketId: selectedTicket.id,
        etaMinutes: Number(etaMinutes || 0),
        routeSequence: Number(routeSequence || 0),
        routeStatus,
        routeNotes,
      });

      toast.success("Route estimate saved.");
    } catch (error) {
      console.error("ROUTE ESTIMATE ERROR:", error);
      toast.error("Could not save route estimate.");
    }
  }, [selectedTicket, etaMinutes, routeSequence, routeStatus, routeNotes]);

  const handleLocationCheckIn = useCallback(() => {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    const techName =
      selectedTicket.assignedTech || selectedTicket.deliveryTechName || "";

    if (!techName) {
      toast.error("Assign a tech before recording location.");
      return;
    }

    if (!navigator.geolocation) {
      toast.error("This device does not support location sharing.");
      return;
    }

    setLocationBusy(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setCurrentLocation(coords);

        void saveTechLocationCheckIn({
          ticket: selectedTicket,
          techName,
          ...coords,
        })
          .then(() => {
            toast.success("Tech location check-in saved.");
          })
          .catch((error) => {
            console.error("TECH LOCATION ERROR:", error);
            toast.error("Could not save tech location.");
          })
          .finally(() => setLocationBusy(false));
      },
      (error) => {
        console.error("LOCATION PERMISSION ERROR:", error);
        toast.error("Location permission was not granted.");
        setLocationBusy(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 12000,
      }
    );
  }, [selectedTicket]);

  return {
    // State
    selectedTicketId,
    setSelectedTicketId,
    scannerOpen,
    scanMode,
    busy,
    signatureDataUrl,
    setSignatureDataUrl,
    signerName,
    setSignerName,
    signerRole,
    setSignerRole,
    signerRelationship,
    setSignerRelationship,
    witnessName,
    setWitnessName,
    refusalReason,
    setRefusalReason,
    returnCondition,
    setReturnCondition,
    returnNotes,
    setReturnNotes,
    damagePhotoFiles,
    damagePhotoNotes,
    setDamagePhotoNotes,
    damagePhotoBusy,
    etaMinutes,
    setEtaMinutes,
    routeSequence,
    setRouteSequence,
    routeStatus,
    setRouteStatus,
    routeNotes,
    setRouteNotes,
    locationBusy,
    currentLocation,

    // Derived
    activeTickets,
    selectedTicket,
    progress,
    exceptions,
    truckLoads,
    bossDeliveryRuns,
    selectedTech,
    routeTickets,
    routeUrl,

    // Handlers
    openScanner,
    closeScanner,
    handleScan,
    handleActorChange,
    handleSaveSignature,
    handleDamagePhotoSelection,
    removeDamagePhoto,
    handleUploadDamagePhotos,
    handleSaveRouteEstimate,
    handleLocationCheckIn,
  };
}

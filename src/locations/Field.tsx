import React, { useEffect, useRef, useState } from "react";
import { AssetCard, Flex, Spinner } from "@contentful/f36-components";
import exifr from "exifr";
import { FieldAppSDK } from "@contentful/app-sdk";
import { useSDK, useAutoResizer } from "@contentful/react-apps-toolkit";
import { AssetProps } from "contentful-management";

const EXIF_CONTENTFUL_FIELD_ID = "exif";
const EXIF_TAGS = [
  "Make",
  "Model",
  "LensMake",
  "LensModel",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "FNumber",
  "ExposureTime",
  "ISO",
  "ISOSpeedRatings",
  "DateTimeOriginal",
  "Orientation",
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
];

const Field: React.FC = () => {
  useAutoResizer();

  const sdk = useSDK<FieldAppSDK>();
  const locale = sdk.field.locale;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const upload = useRef<HTMLInputElement>(null);
  const assetId = sdk.field.getValue()?.sys.id;
  const [existingAsset, setExistingAsset] = useState<AssetProps | undefined>(
    undefined
  );

  useEffect(() => {
    const fetchAsset = async () => {
      if (assetId) {
        try {
          const asset = await sdk.cma.asset.get({ assetId });
          setExistingAsset(asset);
        } catch (error) {
          console.error("Error fetching asset:", error);
        }
      }
    };
    fetchAsset();
  }, [assetId]);

  const createAsset = async () => {
    if (!upload.current?.files?.length) return;
    setIsLoading(true);

    const raw = upload.current.files[0];
    const reader = new FileReader();

    // Write EXIF data to field.
    const exifData = await exifr.parse(raw, EXIF_TAGS);
    sdk.entry.fields[EXIF_CONTENTFUL_FIELD_ID].setValue(exifData);

    // Start upload to Contentful.
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;

        const unprocessedAsset = await sdk.cma.asset.createFromFiles(
          {},
          {
            fields: {
              title: {
                [locale]: raw.name,
              },
              description: {
                [locale]: "",
              },
              file: {
                [locale]: {
                  file: arrayBuffer,
                  contentType: raw.type,
                  fileName: raw.name,
                },
              },
            },
          }
        );

        setIsLoading(false);
        sdk.notifier.success("Uploaded and now processing!");

        // Still need to process the uploaded image as an asset.
        const processedAsset = await sdk.cma.asset.processForAllLocales(
          {},
          unprocessedAsset
        );

        // Finally, update the field value to the new asset.
        setExistingAsset(processedAsset);
        sdk.field.setValue({
          sys: {
            type: "Link",
            linkType: "Asset",
            id: unprocessedAsset.sys.id,
          },
        });
      } catch (error) {
        setIsLoading(false);
        console.error("Error creating asset:", error);
        sdk.notifier.error("Something went wrong!");
      }
    };

    reader.readAsArrayBuffer(raw);
  };

  return (
    <Flex flexDirection="column" gap="spacingXs">
      {existingAsset && (
        <AssetCard
          onClick={() =>
            sdk.navigator.openAsset(existingAsset.sys.id, { slideIn: true })
          }
          src={`${existingAsset.fields.file[sdk.field.locale].url}?h=500`}
        />
      )}

      {!isLoading ? (
        <input ref={upload} type="file" onChange={createAsset} />
      ) : (
        <Spinner />
      )}
    </Flex>
  );
};

export default Field;

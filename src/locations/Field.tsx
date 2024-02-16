import React, { useEffect, useRef, useState } from "react";
import { AssetCard, Flex, Spinner } from "@contentful/f36-components";
import EXIF from "exif-js";
import { FieldAppSDK } from "@contentful/app-sdk";
import { useSDK, useAutoResizer } from "@contentful/react-apps-toolkit";
import { AssetProps } from "contentful-management";

const EXIF_FIELD_ID = "exif";

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

  const createAsset = () => {
    if (!upload.current?.files?.length) return;
    setIsLoading(true);

    const raw = upload.current.files[0];
    const reader = new FileReader();

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

        const exifData = EXIF.readFromBinaryFile(arrayBuffer);
        sdk.entry.fields[EXIF_FIELD_ID].setValue(exifData);

        setIsLoading(false);
        sdk.notifier.success("Uploaded and now processing!");

        await sdk.cma.asset.processForAllLocales({}, unprocessedAsset);

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
          onClick={() => sdk.navigator.openAsset(assetId, { slideIn: true })}
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

import React from "react";
import { Modal, ModalContent, Progress } from "@nextui-org/react";

const ProvisionLoading = ({ loading }) => {
  return (
    <>
      <Modal isOpen={loading} onClose={!loading}>
        <ModalContent>
          <Progress
            size="sm"
            isIndeterminate
            color="primary"
            aria-label="Loading..."
            className="max-w-md"
          />
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProvisionLoading;

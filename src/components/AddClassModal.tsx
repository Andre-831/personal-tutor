import { useState } from "react";

type AddClassModalProps = {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
};

function AddClassModal({ onClose, onCreate }: AddClassModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;

    onCreate(name.trim(), description.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Create class</h2>

        <label>
          Class name
          <input
            type="text"
            placeholder="CSE 130"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label>
          Description
          <input
            type="text"
            placeholder="Computer Systems"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddClassModal;
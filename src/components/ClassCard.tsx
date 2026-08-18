export type Material = {
  id: string;
  name: string;
  type: string;
  size: number;
  storedPath: string;
  addedAt: string;
};

export type ClassData = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  materials: Material[];
};

type ClassCardProps = {
  classData: ClassData;
  onClick: () => void;
};

function ClassCard({
  classData,
  onClick,
}: ClassCardProps) {
  return (
    <button
      className="class-card"
      onClick={onClick}
    >
      <div>
        <h2>{classData.name}</h2>
        <p>
          {classData.description ||
            "No description"}
        </p>
      </div>

      <div className="class-stats">
        <span>
          {classData.materials.length} materials
        </span>
      </div>
    </button>
  );
}

export default ClassCard;
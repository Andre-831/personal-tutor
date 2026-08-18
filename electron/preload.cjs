const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld(
  "desktop",
  {
    platform:
      process.platform,

    /* =========================
       Classes
    ========================= */

    classes: {
      getAll: () =>
        ipcRenderer.invoke(
          "classes:get"
        ),

      create: (
        name,
        description
      ) =>
        ipcRenderer.invoke(
          "classes:create",
          {
            name,
            description,
          }
        ),

      delete: (
        classId
      ) =>
        ipcRenderer.invoke(
          "classes:delete",
          classId
        ),
    },

    /* =========================
   Flashcards
========================= */

flashcards: {
  getAll: (
    classId = undefined
  ) =>
    ipcRenderer.invoke(
      "flashcards:get-all",
      classId
    ),

  get: (
    setId
  ) =>
    ipcRenderer.invoke(
      "flashcards:get",
      setId
    ),

  generate: (
    classId,
    materialId = null,
    count = 10
  ) =>
    ipcRenderer.invoke(
      "flashcards:generate",
      {
        classId,
        materialId,
        count,
      }
    ),

  delete: (
    setId
  ) =>
    ipcRenderer.invoke(
      "flashcards:delete",
      setId
    ),
},

    /* =========================
       Materials
    ========================= */

    materials: {
      add: (
        classId
      ) =>
        ipcRenderer.invoke(
          "materials:add",
          classId
        ),

      open: (
        materialId
      ) =>
        ipcRenderer.invoke(
          "materials:open",
          materialId
        ),

      delete: (
        classId,
        materialId
      ) =>
        ipcRenderer.invoke(
          "materials:delete",
          {
            classId,
            materialId,
          }
        ),
    },

    /* =========================
       Conversations
    ========================= */

    conversations: {
      getAll: () =>
        ipcRenderer.invoke(
          "conversations:get-all"
        ),

      get: (
        conversationId
      ) =>
        ipcRenderer.invoke(
          "conversations:get",
          conversationId
        ),

      getLatest: (
        classId = null
      ) =>
        ipcRenderer.invoke(
          "conversations:get-latest",
          classId
        ),

      create: (
        classId = null
      ) =>
        ipcRenderer.invoke(
          "conversations:create",
          {
            classId,
          }
        ),

      send: (
        conversationId,
        message
      ) =>
        ipcRenderer.invoke(
          "conversations:send",
          {
            conversationId,
            message,
          }
        ),

      /*
       * Subscribe to live conversation
       * updates from Electron.
       */
      onUpdated: (
        callback
      ) => {
        const listener =
          (
            _event,
            conversation
          ) => {
            callback(
              conversation
            );
          };

        ipcRenderer.on(
          "conversation:updated",
          listener
        );

        /*
         * React calls this when the
         * component unmounts.
         */
        return () => {
          ipcRenderer.removeListener(
            "conversation:updated",
            listener
          );
        };
      },
    },
  }
);
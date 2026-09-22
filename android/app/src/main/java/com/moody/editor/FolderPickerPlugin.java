package com.moody.editor;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.MimeTypeMap;
import android.media.MediaScannerConnection;
import android.database.Cursor;
import android.provider.OpenableColumns;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSArray;

import java.io.OutputStream;
import android.util.Base64;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {
    private static final int FOLDER_PICKER_REQUEST = 4201;
    private static final String PREFS = "export_folder";
    private static final String TREE_URI = "tree_uri";
    private Uri activeFileUri;
    private OutputStream activeOutput;
    private String activeFilename;

    @PluginMethod
    public void pickImages(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "imagePickerResult");
    }

    @ActivityCallback
    private void imagePickerResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Image selection cancelled");
            return;
        }
        Intent data = result.getData();
        JSArray images = new JSArray();
        try {
            if (data.getClipData() != null) {
                for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                    images.put(readImage(data.getClipData().getItemAt(i).getUri()));
                }
            } else if (data.getData() != null) {
                images.put(readImage(data.getData()));
            }
            if (images.length() == 0) {
                call.reject("No image selected");
                return;
            }
            call.resolve(new JSObject().put("images", images));
        } catch (Exception e) {
            call.reject("Could not import image: " + e.getMessage());
        }
    }

    private JSObject readImage(Uri uri) throws Exception {
        int flags = Intent.FLAG_GRANT_READ_URI_PERMISSION;
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException ignored) {}
        byte[] bytes;
        try (java.io.InputStream input = getContext().getContentResolver().openInputStream(uri);
             java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
            if (input == null) throw new Exception("Image stream unavailable");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            bytes = output.toByteArray();
        }
        String mime = getContext().getContentResolver().getType(uri);
        if (mime == null) mime = "image/jpeg";
        JSObject image = new JSObject();
        image.put("name", getDisplayName(uri));
        image.put("type", mime);
        image.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
        return image;
    }

    private String getDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(
                uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {}
        return "image.jpg";
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            call.reject("Folder selection cancelled");
            return;
        }

        Uri uri = result.getData().getData();
        int takeFlags = result.getData().getFlags()
                & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (SecurityException ignored) {
            // The selected folder can still be used for this app session.
        }
        getContext().getSharedPreferences(PREFS, 0)
                .edit().putString(TREE_URI, uri.toString()).apply();

        JSObject ret = new JSObject();
        ret.put("name", getFolderName(uri));
        call.resolve(ret);
    }

    @PluginMethod
    public void beginWrite(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.isEmpty()) {
            call.reject("filename is required");
            return;
        }

        String tree = getContext().getSharedPreferences(PREFS, 0).getString(TREE_URI, null);
        if (tree == null) {
            call.reject("Choose an export folder first");
            return;
        }

        Uri treeUri = Uri.parse(tree);
        String mime = getMimeType(filename);
        try {
            closeActiveOutput();
            Uri parentUri = DocumentsContract.buildDocumentUriUsingTree(
                    treeUri, DocumentsContract.getTreeDocumentId(treeUri));
            activeFileUri = DocumentsContract.createDocument(
                    getContext().getContentResolver(), parentUri, mime, filename);
            if (activeFileUri == null) {
                call.reject("Could not create export file");
                return;
            }
            activeOutput = getContext().getContentResolver().openOutputStream(activeFileUri);
            if (activeOutput == null) {
                call.reject("Could not open export file");
                return;
            }
            activeFilename = filename;
        } catch (Exception e) {
            call.reject("Could not save export: " + e.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("uri", activeFileUri.toString());
        ret.put("folder", getFolderName(treeUri));
        call.resolve(ret);
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        String data = call.getString("data");
        if (activeOutput == null || data == null) {
            call.reject("No active export");
            return;
        }
        try {
            activeOutput.write(Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            closeActiveOutput();
            call.reject("Could not write export chunk: " + e.getMessage());
        }
    }

    @PluginMethod
    public void finishWrite(PluginCall call) {
        if (activeOutput == null || activeFileUri == null) {
            call.reject("No active export");
            return;
        }
        try {
            activeOutput.flush();
            closeActiveOutput();
            MediaScannerConnection.scanFile(
                    getContext(), new String[] { activeFileUri.toString() },
                    new String[] { getMimeType(activeFilename) }, null);
            call.resolve(new JSObject().put("uri", activeFileUri.toString()));
        } catch (Exception e) {
            closeActiveOutput();
            call.reject("Could not finish export: " + e.getMessage());
        } finally {
            activeFileUri = null;
            activeFilename = null;
        }
    }

    private void closeActiveOutput() {
        if (activeOutput != null) {
            try { activeOutput.close(); } catch (Exception ignored) {}
            activeOutput = null;
        }
    }

    private String getFolderName(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty()) return "Selected folder";
        int slash = path.lastIndexOf('/');
        String name = slash >= 0 ? path.substring(slash + 1) : path;
        return name.replace(":", " / ");
    }

    private String getMimeType(String filename) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(filename);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return mime != null ? mime : "application/octet-stream";
    }
}

// Helper function
const stripFields = (array, allowedKeys) =>
  array.map(item => {
    const clean = {};
    allowedKeys.forEach(key => {
      clean[key] = item[key];
    });
    return clean;
  });

const formatPrescriptions = (prescriptions) =>
  Array.isArray(prescriptions)
    ? prescriptions.map(p => `${p.medicineId} (${p.dosage}, ${p.duration}) - ${p.instructions}`).join("; ")
    : "";

document.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("btnExportData");
    if (!exportBtn) return;

    exportBtn.addEventListener("click", async () => {
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (!user) return console.warn("No logged-in user found.");

        const userId = user.linkedId;

        await logCurrentUserActivity("Exported Linked Data", userId, `User with ID ${userId} exported all data linked to their account.`);
        try {
            if (!db) await openClinicDB();

            


            const patientFields = ["id", "NHS", "Title", "First", "Last", "Gender", "Address", "Email", "Telephone", "DOB"];
            const doctorFields = ["id", "first_name", "last_name", "gender", "email", "Address", "Telephone"];
            const recordFields = ["recordId", "patientId", "doctorId", "dateTime", "prescriptions", "accessedBy", "diagnosis", "treatment"];
            const appointmentFields = ["appointmentId", "patientId", "doctorId", "date", "time", "reason", "status"];
            const activityFields = ["logId", "userId", "userRole", "action", "target", "timestamp", "details"];
            const notificationFields = ["notifId", "title", "message", "recipientId", "recipientRole", "date", "read"];

            // ✅ Load everything
            const [
                allPatients,
                allDoctors,
                allRecords,
                allAppts,
                allNotifs,
                allAct,
            ] = await Promise.all([
                getAllItems("patients"),
                getAllItems("doctors"),
                getAllItems("medicalRecord"),
                getAllItems("appointments"),
                getNotifications(userId),
                getAllItems("activityLogs")
            ]);

            // ✅ Decrypt all patients
            const allPatientsDecrypted = await Promise.all(
                allPatients.map(p => decryptPatientInfo(p))
            );

            // ✅ Decrypt all doctors
            const allDoctorsDecrypted = await Promise.all(
                allDoctors.map(p => decryptDoctorInfo(p))
            );

            // ✅ Decrypt medical records
            for (let i = 0; i < allRecords.length; i++) {
                allRecords[i] = await decryptMedicalRecord(allRecords[i]);
            }

            // Filter patients (if user is a patient)
            const filteredPatients = allPatientsDecrypted.filter(p => p.NHS === userId);

            // Filter doctors (if user is a doctor)
            const filteredDoctors = allDoctorsDecrypted.filter(d => d.id === userId);

            // Filter and clean medical records (linked to user as patient or doctor)
            const filteredRecords = allRecords.filter(r =>
            r.patientId === userId || r.doctorId === userId
            );
            const cleanedRecords = filteredRecords.map(r => ({
                ...r,
                prescriptions: formatPrescriptions(r.prescriptions)
            }));

            // Filter appointments (linked to user as patient or doctor)
            const filteredAppointments = allAppts.filter(a =>
            a.patientId === userId || a.doctorId === userId
            );

            // Filter activity logs (linked to user)
            const filteredActivityLogs = allAct.filter(l => l.userId === userId )


            // ✅ Build PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "pt", format: "a4" });

            // ============= HEADER =================
            doc.setFontSize(18);
            doc.text("MedTrack — Exported Personal Data", 40, 40);

            doc.setFontSize(12);
            doc.setTextColor(120);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 60);

            let y = 90;

            // =============================
            // ✅ FUNCTION: GENERATE TABLE
            // =============================
            const makeTable = (title, array) => {
                if (!array || array.length === 0) return;

                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.text(title, 40, y);
                y += 10;

                const columns = Object.keys(array[0]).map(k => ({ header: k, dataKey: k }));

                doc.autoTable({
                    startY: y + 5,
                    theme: "grid",
                    headStyles: { fillColor: [0, 123, 255] },
                    styles: { fontSize: 9 },
                    columns: columns,
                    body: array
                });

                y = doc.lastAutoTable.finalY + 20;
            };

            // ============= ADD TABLES ===============

           if (user.role.toLowerCase() === 'patient') {
            makeTable("User Information", stripFields(filteredPatients, patientFields));
            makeTable("Medical Records", stripFields(cleanedRecords, recordFields));
            makeTable("Appointments", stripFields(filteredAppointments, appointmentFields));
            makeTable("Notifications", stripFields(allNotifs, notificationFields));
            makeTable("Activity Logs", stripFields(filteredActivityLogs, activityFields));
            } else if (user.role.toLowerCase() === 'doctor') {
            makeTable("User Information", stripFields(filteredDoctors, doctorFields));
            makeTable("Medical Records", stripFields(cleanedRecords, recordFields));
            makeTable("Appointments", stripFields(filteredAppointments, appointmentFields));
            makeTable("Notifications", stripFields(allNotifs, notificationFields));
            makeTable("Activity Logs", stripFields(filteredActivityLogs, activityFields));
            }


            // ✅ Save PDF
            doc.save("My_MedTrack_Data.pdf");

        } catch (err) {
            console.error(err);
            alert("Error exporting data. Check console.");
        }
    });
});
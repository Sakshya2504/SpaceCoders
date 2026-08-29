// Normalize the patient-create response in one place so the intake page can
// safely handle the API envelope without depending on a single response shape.
export function getCreatedPatientId(response) {
  const patient = response?.data?.data;

  return patient?.patientId || patient?._id || patient?.id || null;
}

export function getApiMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.details ||
    error?.message ||
    fallback
  );
}

-- Estende a trilha de auditoria (fn_write_audit_log, definida em
-- add_audit_trigger) para as tabelas da integracao LDAP por unidade.
CREATE TRIGGER trg_audit_ldap_configs
AFTER INSERT OR UPDATE ON ldap_configs
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_ldap_group_mappings
AFTER INSERT OR UPDATE ON ldap_group_mappings
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_role_elevation_requests
AFTER INSERT OR UPDATE ON role_elevation_requests
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

-- T167 — o gatilho de auditoria (fn_write_audit_log, criado em
-- 20260713195352_add_audit_trigger e reescrito em
-- 20260808120500_migrate_audit_log_to_audit_schema) so cobria
-- indicator_responses e evidence_files. Toda alteracao administrativa —
-- usuario, unidade, acesso, formulario, parametro, veredito de validacao —
-- nao deixava rastro nenhum (cenario US5-5). Estende a cobertura as 8
-- tabelas auditaveis restantes.
CREATE TRIGGER trg_audit_users
AFTER INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_units
AFTER INSERT OR UPDATE ON units
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_user_unit_access
AFTER INSERT OR UPDATE ON user_unit_access
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_form_templates
AFTER INSERT OR UPDATE ON form_templates
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_form_topics
AFTER INSERT OR UPDATE ON form_topics
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_form_indicators
AFTER INSERT OR UPDATE ON form_indicators
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_system_settings
AFTER INSERT OR UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_validation_records
AFTER INSERT OR UPDATE ON validation_records
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

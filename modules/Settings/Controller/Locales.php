<?php

namespace Settings\Controller;

use App\Controller\App;
use ArrayObject;

class Locales extends App {

    protected function before() {

        if (!$this->isAllowed('app.locales.manage')) {
            $this->stop(401);
        }
    }

    public function index() {
        return $this->render('settings:views/locales/index.php');
    }

    public function locale($id = null) {

        if (!$id) {
            return $this->stop(['error' => 'locale id is missing'], 412);
        }

        $locale = $this->app->data->findOne('system/locales', ['_id' => $id]);

        if (!$locale) {
            return false;
        }

        $locale['meta'] = new ArrayObject( $locale['meta']);

        return $this->render('settings:views/locales/locale.php', compact('locale'));
    }

    public function create() {

        $locale = [
            'i18n' => '',
            'name'  => '',
            'meta' => new ArrayObject([])
        ];

        return $this->render('settings:views/locales/locale.php', compact('locale'));
    }

    public function remove() {

        $locale = $this->param('locale');

        if (!$locale || !isset($locale['_id'], $locale['i18n'])) {
            return $this->stop(['error' => 'locale is missing'], 412);
        }

        $this->app->data->remove('system/locales', ['_id' => $locale['_id']]);

        $this->app->trigger('app.locales.remove', [$locale]);

        $this->cache();

        return ['success' => true];
    }

    public function save() {

        $locale = $this->param('locale');

        if (!$locale) {
            return $this->stop(['error' => 'locale data is missing'], 412);
        }

        $locale['_modified'] = time();
        $isUpdate = isset($locale['_id']);

        if (!$isUpdate) {
            $locale['_created'] = $locale['_modified'];
        }

        if (!isset($locale['i18n']) || !trim($locale['i18n'])) {
            return $this->stop(['error' => 'i18n required'], 412);
        }

        foreach (['i18n', 'name'] as $key) {
            $locale[$key] = strip_tags(trim($locale[$key]));
        }

        // unique check

        $_locale = $this->app->data->findOne('system/locales', ['i18n' => $locale['i18n']]);

        if ($_locale && (!isset($locale['_id']) || $locale['_id'] != $_locale['_id'])) {
            $this->app->stop(['error' => 'Locale is already used!'], 412);
        }

        $this->app->trigger('app.locales.save', [&$locale, $isUpdate]);
        $this->app->data->save('system/locales', $locale);

        $locale = $this->app->data->findOne('system/locales', ['_id' => $locale['_id']]);

        $locale['meta'] = new ArrayObject(is_array($locale['meta']) ? $locale['meta'] : []);

        $this->cache();

        return $locale;
    }

    public function load() {

        \session_write_close();

        $locales = $this->app->data->find('system/locales', [
            'sort' => ['name' => 1]
        ])->toArray();

        return $locales;
    }

    protected function cache() {
        $this->helper('locales')->cache();
    }
}